-- API Keys and Audit Log Tables for YSTR Matcher
-- Created: 2025-10-08
-- Purpose: Secure API access and complete audit trail

-- Table for API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0
);

-- Indexes for api_keys
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Table for audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER REFERENCES api_keys(id),
    operation VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_log
CREATE INDEX idx_audit_log_api_key ON audit_log(api_key_id);
CREATE INDEX idx_audit_log_operation ON audit_log(operation);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_api_key_created ON audit_log(api_key_id, created_at DESC);

-- Function to automatically update last_used_at and usage_count
CREATE OR REPLACE FUNCTION update_api_key_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.api_key_id IS NOT NULL THEN
        UPDATE api_keys
        SET last_used_at = CURRENT_TIMESTAMP,
            usage_count = usage_count + 1
        WHERE id = NEW.api_key_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger to update API key usage
CREATE TRIGGER trigger_update_api_key_usage
    AFTER INSERT ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION update_api_key_usage();

-- Function to check if API key is valid
CREATE OR REPLACE FUNCTION is_api_key_valid(key_hash_param VARCHAR(64))
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    key_record RECORD;
BEGIN
    SELECT * INTO key_record
    FROM api_keys
    WHERE key_hash = key_hash_param
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

    RETURN FOUND;
END;
$$;

-- Function to get API key permissions
CREATE OR REPLACE FUNCTION get_api_key_permissions(key_hash_param VARCHAR(64))
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    perms JSONB;
BEGIN
    SELECT permissions INTO perms
    FROM api_keys
    WHERE key_hash = key_hash_param
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

    RETURN COALESCE(perms, '{}'::jsonb);
END;
$$;

-- Function to log audit entry
CREATE OR REPLACE FUNCTION log_audit(
    p_api_key_id INTEGER,
    p_operation VARCHAR(50),
    p_table_name VARCHAR(100),
    p_record_id VARCHAR(100),
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    audit_id INTEGER;
BEGIN
    INSERT INTO audit_log (
        api_key_id,
        operation,
        table_name,
        record_id,
        old_data,
        new_data,
        ip_address,
        user_agent,
        success,
        error_message
    ) VALUES (
        p_api_key_id,
        p_operation,
        p_table_name,
        p_record_id,
        p_old_data,
        p_new_data,
        p_ip_address,
        p_user_agent,
        p_success,
        p_error_message
    )
    RETURNING id INTO audit_id;

    RETURN audit_id;
END;
$$;

-- View for audit log summary
CREATE OR REPLACE VIEW audit_log_summary AS
SELECT
    al.id,
    al.created_at,
    al.operation,
    al.table_name,
    al.record_id,
    al.success,
    ak.name as api_key_name,
    ak.id as api_key_id,
    al.ip_address
FROM audit_log al
LEFT JOIN api_keys ak ON al.api_key_id = ak.id
ORDER BY al.created_at DESC;

-- Comments for documentation
COMMENT ON TABLE api_keys IS 'Stores API keys for authenticated access to the system';
COMMENT ON TABLE audit_log IS 'Complete audit trail of all data modifications';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the API key';
COMMENT ON COLUMN api_keys.permissions IS 'JSONB object with permission flags (e.g. {"samples.create": true})';
COMMENT ON COLUMN audit_log.old_data IS 'JSONB snapshot of data before modification';
COMMENT ON COLUMN audit_log.new_data IS 'JSONB snapshot of data after modification';

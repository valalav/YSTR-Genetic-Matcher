-- Haplogroup Databases Metadata Table
-- Stores information about loaded haplogroup databases

CREATE TABLE IF NOT EXISTS haplogroup_databases (
    id SERIAL PRIMARY KEY,
    haplogroup VARCHAR(50) NOT NULL UNIQUE,
    total_profiles INTEGER DEFAULT 0,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, loading, error, deleted
    source_file VARCHAR(255),
    file_size_mb DECIMAL(10,2),
    avg_markers DECIMAL(5,2),
    description TEXT,

    CONSTRAINT valid_status CHECK (status IN ('active', 'loading', 'error', 'deleted'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_haplogroup_databases_status
    ON haplogroup_databases(status);

CREATE INDEX IF NOT EXISTS idx_haplogroup_databases_haplogroup
    ON haplogroup_databases(haplogroup) WHERE status = 'active';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_haplogroup_databases_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_haplogroup_databases_timestamp
    BEFORE UPDATE ON haplogroup_databases
    FOR EACH ROW
    EXECUTE FUNCTION update_haplogroup_databases_timestamp();

-- Comments
COMMENT ON TABLE haplogroup_databases IS 'Metadata about loaded haplogroup databases';
COMMENT ON COLUMN haplogroup_databases.haplogroup IS 'Haplogroup identifier (e.g., R1a, R1b, E, J1, etc.)';
COMMENT ON COLUMN haplogroup_databases.total_profiles IS 'Total number of profiles in this database';
COMMENT ON COLUMN haplogroup_databases.status IS 'Current status: active, loading, error, deleted';
COMMENT ON COLUMN haplogroup_databases.source_file IS 'Original CSV filename or source URL';
COMMENT ON COLUMN haplogroup_databases.file_size_mb IS 'Original file size in megabytes';
COMMENT ON COLUMN haplogroup_databases.avg_markers IS 'Average number of markers per profile';

-- PostgreSQL schema for optimized YSTR matching
-- Designed for handling 100-200k samples

-- Extension for improved text search and GIN indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Main profiles table with optimized structure
CREATE TABLE ystr_profiles (
    id SERIAL PRIMARY KEY,
    kit_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    country VARCHAR(50),
    haplogroup VARCHAR(50),

    -- Store all STR markers as JSONB for flexibility and indexing
    markers JSONB NOT NULL,

    -- Pre-computed hash for fast duplicate detection
    markers_hash CHAR(64) GENERATED ALWAYS AS (
        encode(sha256(markers::text::bytea), 'hex')
    ) STORED,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indexes for fast querying
CREATE INDEX idx_ystr_profiles_kit_number ON ystr_profiles(kit_number);
CREATE INDEX idx_ystr_profiles_haplogroup ON ystr_profiles(haplogroup) WHERE haplogroup IS NOT NULL;
CREATE INDEX idx_ystr_profiles_markers_hash ON ystr_profiles(markers_hash);

-- GIN index for fast JSONB operations on markers
CREATE INDEX idx_ystr_profiles_markers_gin ON ystr_profiles USING GIN (markers);

-- Haplogroups lookup table for hierarchical filtering
CREATE TABLE haplogroups (
    id SERIAL PRIMARY KEY,
    haplogroup VARCHAR(50) UNIQUE NOT NULL,
    parent_haplogroup VARCHAR(50),
    level INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (parent_haplogroup) REFERENCES haplogroups(haplogroup)
);

-- Index for haplogroup hierarchy queries
CREATE INDEX idx_haplogroups_parent ON haplogroups(parent_haplogroup);
CREATE INDEX idx_haplogroups_level ON haplogroups(level);

-- Materialized view for fast marker statistics
CREATE MATERIALIZED VIEW marker_statistics AS
SELECT
    key as marker_name,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN value != '' AND value IS NOT NULL THEN 1 END) as profiles_with_value,
    ARRAY_AGG(DISTINCT value ORDER BY value) FILTER (WHERE value != '' AND value IS NOT NULL) as unique_values
FROM ystr_profiles, JSONB_EACH_TEXT(markers)
GROUP BY key;

CREATE INDEX idx_marker_stats_name ON marker_statistics(marker_name);

-- Function for calculating genetic distance between two marker sets
CREATE OR REPLACE FUNCTION calculate_genetic_distance(
    markers1 JSONB,
    markers2 JSONB,
    marker_count INTEGER DEFAULT 37
) RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    marker_keys TEXT[];
    key TEXT;
    val1 TEXT;
    val2 TEXT;
    differences INTEGER := 0;
    compared INTEGER := 0;
BEGIN
    -- Get intersection of marker keys (only common markers with valid values)
    SELECT ARRAY_AGG(k) INTO marker_keys
    FROM (
        SELECT k
        FROM jsonb_object_keys(markers1) k
        WHERE markers1->>k != '' AND markers1->>k IS NOT NULL
          AND markers2->>k != '' AND markers2->>k IS NOT NULL
        LIMIT marker_count
    ) common_keys;

    FOREACH key IN ARRAY marker_keys
    LOOP
        val1 := markers1->>key;
        val2 := markers2->>key;

        -- Values are already validated in the selection query above
        compared := compared + 1;
        IF val1 != val2 THEN
            differences := differences + 1;
        END IF;
    END LOOP;

    RETURN differences;
END;
$$;

-- Function for fast batch marker comparison
CREATE OR REPLACE FUNCTION find_matches_batch(
    query_markers JSONB,
    max_distance INTEGER DEFAULT 25,
    max_results INTEGER DEFAULT 1000,
    marker_count INTEGER DEFAULT 37,
    haplogroup_filter VARCHAR DEFAULT NULL,
    include_subclades BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    kit_number VARCHAR,
    name VARCHAR,
    country VARCHAR,
    haplogroup VARCHAR,
    markers JSONB,
    genetic_distance INTEGER,
    compared_markers INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_profiles AS (
        SELECT p.*
        FROM ystr_profiles p
        WHERE (haplogroup_filter IS NULL
               OR (include_subclades AND p.haplogroup LIKE haplogroup_filter || '%')
               OR (NOT include_subclades AND p.haplogroup = haplogroup_filter))
    ),
    distances AS (
        SELECT
            fp.kit_number,
            fp.name,
            fp.country,
            fp.haplogroup,
            fp.markers,
            calculate_genetic_distance(query_markers, fp.markers, marker_count) as distance,
            (
                SELECT COUNT(*)
                FROM (
                    SELECT k
                    FROM jsonb_object_keys(query_markers) k
                    WHERE query_markers->>k != '' AND query_markers->>k IS NOT NULL
                      AND fp.markers->>k != '' AND fp.markers->>k IS NOT NULL
                    LIMIT marker_count
                ) common_markers
            )::INTEGER as compared
        FROM filtered_profiles fp
    )
    SELECT
        d.kit_number,
        d.name,
        d.country,
        d.haplogroup,
        d.markers,
        d.distance,
        d.compared
    FROM distances d
    WHERE d.distance <= max_distance
    ORDER BY d.distance ASC, d.kit_number ASC
    LIMIT max_results;
END;
$$;

-- Optimized function for bulk insert with conflict resolution
CREATE OR REPLACE FUNCTION bulk_insert_profiles(profiles_data JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    inserted_count INTEGER := 0;
    profile JSONB;
BEGIN
    FOR profile IN SELECT jsonb_array_elements(profiles_data)
    LOOP
        INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
        VALUES (
            profile->>'kit_number',
            profile->>'name',
            profile->>'country',
            profile->>'haplogroup',
            profile->'markers'
        )
        ON CONFLICT (kit_number)
        DO UPDATE SET
            name = EXCLUDED.name,
            country = EXCLUDED.country,
            haplogroup = EXCLUDED.haplogroup,
            markers = EXCLUDED.markers,
            updated_at = CURRENT_TIMESTAMP;

        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$$;

-- Trigger to update materialized view after data changes
CREATE OR REPLACE FUNCTION refresh_marker_statistics()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY marker_statistics;
    RETURN NULL;
END;
$$;

-- Create trigger for automatic statistics refresh
CREATE TRIGGER trigger_refresh_marker_stats
    AFTER INSERT OR UPDATE OR DELETE ON ystr_profiles
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_marker_statistics();

-- Create partitioning by haplogroup for very large datasets (optional)
-- Uncomment if dealing with millions of records
/*
CREATE TABLE ystr_profiles_r1a PARTITION OF ystr_profiles
    FOR VALUES WITH (modulus 10, remainder 0);
CREATE TABLE ystr_profiles_r1b PARTITION OF ystr_profiles
    FOR VALUES WITH (modulus 10, remainder 1);
-- Add more partitions as needed
*/

-- Views for common queries
CREATE VIEW profile_summary AS
SELECT
    kit_number,
    name,
    haplogroup,
    jsonb_object_keys(markers) as available_markers_count,
    created_at
FROM ystr_profiles;

-- Performance monitoring view
CREATE VIEW performance_stats AS
SELECT
    'total_profiles' as metric,
    COUNT(*)::TEXT as value
FROM ystr_profiles
UNION ALL
SELECT
    'unique_haplogroups' as metric,
    COUNT(DISTINCT haplogroup)::TEXT as value
FROM ystr_profiles
UNION ALL
SELECT
    'avg_markers_per_profile' as metric,
    AVG((SELECT COUNT(*) FROM jsonb_object_keys(markers)))::TEXT as value
FROM ystr_profiles;
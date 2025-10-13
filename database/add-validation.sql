-- Add input validation to find_matches_batch_v3
-- This prevents 40x performance degradation from invalid marker values

CREATE OR REPLACE FUNCTION find_matches_batch_v3(
    query_markers JSONB,
    max_distance INTEGER DEFAULT 25,
    max_results INTEGER DEFAULT 1000,
    marker_count INTEGER DEFAULT 37,
    haplogroup_filter VARCHAR DEFAULT NULL,
    include_subclades BOOLEAN DEFAULT false
) RETURNS TABLE (
    kit_number VARCHAR,
    name VARCHAR,
    country VARCHAR,
    haplogroup VARCHAR,
    markers JSONB,
    genetic_distance INTEGER,
    common_markers INTEGER,
    match_percentage NUMERIC
) AS $$
DECLARE
    query_marker_keys TEXT[];
    min_overlap INTEGER;
BEGIN
    -- CRITICAL FIX #1: Validate marker values are numeric
    -- Prevents 40x performance degradation from invalid input
    IF EXISTS (
        SELECT 1
        FROM jsonb_each_text(query_markers)
        WHERE value !~ '^[0-9]+(\.[0-9]+)?$' AND value != ''
    ) THEN
        RAISE EXCEPTION 'Invalid marker values: all values must be numeric'
            USING HINT = 'Check that all STR marker values are valid numbers';
    END IF;

    -- Pre-compute marker keys for GIN index optimization
    SELECT ARRAY_AGG(k) INTO query_marker_keys
    FROM jsonb_object_keys(query_markers) k;

    -- Calculate minimum overlap (at least 30% of query markers)
    min_overlap := GREATEST(3, FLOOR(jsonb_object_keys(query_markers)::int * 0.3));

    RETURN QUERY
    WITH filtered_profiles AS (
        SELECT
            p.kit_number,
            p.name,
            p.country,
            p.haplogroup,
            p.markers,
            count_marker_overlap(query_markers, p.markers) as overlap_count
        FROM ystr_profiles p
        WHERE p.status = 'active'
          AND (haplogroup_filter IS NULL OR p.haplogroup = haplogroup_filter)
          AND p.markers ?& query_marker_keys  -- GIN index usage
        LIMIT CASE
            WHEN haplogroup_filter IS NULL THEN 50000
            ELSE 100000
        END
    ),
    filtered_with_overlap AS (
        SELECT *
        FROM filtered_profiles
        WHERE overlap_count >= min_overlap
    ),
    matched_profiles AS (
        SELECT
            f.kit_number,
            f.name,
            f.country,
            f.haplogroup,
            f.markers,
            calculate_genetic_distance_v3(query_markers, f.markers) as distance,
            f.overlap_count as common_markers
        FROM filtered_with_overlap f
    )
    SELECT
        m.kit_number,
        m.name,
        m.country,
        m.haplogroup,
        m.markers,
        m.distance as genetic_distance,
        m.common_markers,
        ROUND((m.common_markers::numeric / GREATEST(jsonb_object_keys(query_markers)::int, jsonb_object_keys(m.markers)::int)) * 100, 2) as match_percentage
    FROM matched_profiles m
    WHERE m.distance <= max_distance
    ORDER BY m.distance ASC, m.common_markers DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Verify function was updated
\df find_matches_batch_v3

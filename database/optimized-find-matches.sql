-- Optimized version of find_matches_batch function
-- Uses GIN index with ?& operator for better performance

CREATE OR REPLACE FUNCTION find_matches_batch_v2(
    query_markers JSONB,
    max_distance INTEGER DEFAULT 25,
    max_results INTEGER DEFAULT 1000,
    marker_count INTEGER DEFAULT 37,
    haplogroup_filter VARCHAR DEFAULT NULL,
    include_subclades BOOLEAN DEFAULT false
) RETURNS TABLE(
    kit_number VARCHAR,
    name VARCHAR,
    country VARCHAR,
    haplogroup VARCHAR,
    markers JSONB,
    genetic_distance INTEGER,
    compared_markers INTEGER
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    query_marker_keys TEXT[];
BEGIN
    -- Pre-compute array of query marker keys for GIN index
    SELECT ARRAY_AGG(k) INTO query_marker_keys
    FROM jsonb_object_keys(query_markers) k
    WHERE query_markers->>k IS NOT NULL AND query_markers->>k != ''
    LIMIT marker_count;

    -- If no valid markers, return empty
    IF query_marker_keys IS NULL OR array_length(query_marker_keys, 1) IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH filtered_profiles AS (
        SELECT p.*
        FROM ystr_profiles p
        WHERE
            -- Haplogroup filter (uses B-tree index)
            (haplogroup_filter IS NULL
               OR (include_subclades AND p.haplogroup LIKE haplogroup_filter || '%')
               OR (NOT include_subclades AND p.haplogroup = haplogroup_filter))
            -- Marker containment filter (uses GIN index!)
            AND p.markers ?& query_marker_keys
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
                    FROM unnest(query_marker_keys) k
                    WHERE fp.markers->>k IS NOT NULL AND fp.markers->>k != ''
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

-- Create index hint comment
COMMENT ON FUNCTION find_matches_batch_v2 IS
'Optimized version using GIN index with ?& operator. Significantly faster for queries without haplogroup filter.';


-- Optimized calculate_genetic_distance function
CREATE OR REPLACE FUNCTION calculate_genetic_distance_v2(
    markers1 JSONB,
    markers2 JSONB,
    marker_count INTEGER DEFAULT 37
) RETURNS INTEGER
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
    SELECT COALESCE(
        (
            SELECT COUNT(*)::INTEGER
            FROM (
                SELECT k
                FROM jsonb_object_keys(markers1) k
                WHERE markers1->>k IS NOT NULL
                  AND markers1->>k != ''
                  AND markers2->>k IS NOT NULL
                  AND markers2->>k != ''
                  AND markers1->>k != markers2->>k
                LIMIT marker_count
            ) differences
        ),
        999  -- Return high value if no common markers
    );
$$;

COMMENT ON FUNCTION calculate_genetic_distance_v2 IS
'Optimized SQL version (instead of plpgsql) for better query planning and parallelization.';


-- Test performance comparison
DO $$
DECLARE
    test_markers JSONB := '{"DYS19": "14", "DYS390": "21", "DYS391": "10"}'::JSONB;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    v1_duration INTEGER;
    v2_duration INTEGER;
BEGIN
    -- Test v1 (old)
    start_time := clock_timestamp();
    PERFORM * FROM find_matches_batch(test_markers, 5, 10, 37, NULL, false);
    end_time := clock_timestamp();
    v1_duration := EXTRACT(MILLISECONDS FROM (end_time - start_time));

    -- Test v2 (new)
    start_time := clock_timestamp();
    PERFORM * FROM find_matches_batch_v2(test_markers, 5, 10, 37, NULL, false);
    end_time := clock_timestamp();
    v2_duration := EXTRACT(MILLISECONDS FROM (end_time - start_time));

    RAISE NOTICE 'Performance comparison:';
    RAISE NOTICE '  v1 (old): % ms', v1_duration;
    RAISE NOTICE '  v2 (new): % ms', v2_duration;
    RAISE NOTICE '  Improvement: %x faster', ROUND(v1_duration::NUMERIC / NULLIF(v2_duration, 0), 2);
END $$;

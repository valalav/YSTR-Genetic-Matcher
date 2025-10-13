-- Ultra-optimized version with aggressive pre-filtering
-- Uses combination of indexes and early distance filtering

CREATE OR REPLACE FUNCTION find_matches_batch_v3(
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
    min_required_matches INTEGER;
BEGIN
    -- Extract valid marker keys
    SELECT ARRAY_AGG(k) INTO query_marker_keys
    FROM jsonb_object_keys(query_markers) k
    WHERE query_markers->>k IS NOT NULL AND query_markers->>k != ''
    LIMIT marker_count;

    -- If no valid markers, return empty
    IF query_marker_keys IS NULL OR array_length(query_marker_keys, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Calculate minimum required overlapping markers
    -- For GD <= max_distance, need at least this many common markers
    min_required_matches := GREATEST(1, array_length(query_marker_keys, 1) - max_distance);

    RETURN QUERY
    WITH filtered_profiles AS (
        SELECT
            p.kit_number,
            p.name,
            p.country,
            p.haplogroup,
            p.markers
        FROM ystr_profiles p
        WHERE
            -- Haplogroup filter
            (haplogroup_filter IS NULL
               OR (include_subclades AND p.haplogroup LIKE haplogroup_filter || '%')
               OR (NOT include_subclades AND p.haplogroup = haplogroup_filter))
            -- Quick marker overlap check using GIN
            AND p.markers ?& query_marker_keys
        -- Limit early to avoid scanning too many rows
        LIMIT CASE
            WHEN haplogroup_filter IS NULL THEN 50000  -- Limit full DB scan
            ELSE 100000  -- More generous with filter
        END
    ),
    distances AS (
        SELECT
            fp.kit_number,
            fp.name,
            fp.country,
            fp.haplogroup,
            fp.markers,
            -- Optimized distance calculation
            (
                SELECT COUNT(*)::INTEGER
                FROM unnest(query_marker_keys) k
                WHERE fp.markers->>k IS NOT NULL
                  AND fp.markers->>k != ''
                  AND query_markers->>k != fp.markers->>k
            ) as distance,
            -- Count compared markers
            (
                SELECT COUNT(*)::INTEGER
                FROM unnest(query_marker_keys) k
                WHERE fp.markers->>k IS NOT NULL AND fp.markers->>k != ''
            ) as compared
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
      AND d.compared >= min_required_matches  -- Additional filter
    ORDER BY d.distance ASC, d.kit_number ASC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION find_matches_batch_v3 IS
'Ultra-optimized with early LIMIT and minimum overlap filtering. Best performance for large datasets.';


-- Alternative approach: Create helper function for fast marker overlap count
CREATE OR REPLACE FUNCTION count_marker_overlap(
    markers1 JSONB,
    markers2 JSONB,
    marker_keys TEXT[]
) RETURNS INTEGER
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM unnest(marker_keys) k
    WHERE markers1->>k IS NOT NULL
      AND markers1->>k != ''
      AND markers2->>k IS NOT NULL
      AND markers2->>k != '';
$$;


-- Improved distance calculation using helper
CREATE OR REPLACE FUNCTION calculate_genetic_distance_v3(
    markers1 JSONB,
    markers2 JSONB,
    marker_count INTEGER DEFAULT 37
) RETURNS INTEGER
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
    WITH marker_keys AS (
        SELECT k
        FROM jsonb_object_keys(markers1) k
        WHERE markers1->>k IS NOT NULL AND markers1->>k != ''
        LIMIT marker_count
    )
    SELECT COALESCE(
        (
            SELECT COUNT(*)::INTEGER
            FROM marker_keys mk
            WHERE markers2->>mk.k IS NOT NULL
              AND markers2->>mk.k != ''
              AND markers1->>mk.k != markers2->>mk.k
        ),
        999
    );
$$;


-- Performance test
DO $$
DECLARE
    test_markers JSONB := '{"DYS19": "14", "DYS390": "21", "DYS391": "10"}'::JSONB;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    v1_duration INTEGER;
    v2_duration INTEGER;
    v3_duration INTEGER;
    v1_count INTEGER;
    v2_count INTEGER;
    v3_count INTEGER;
BEGIN
    RAISE NOTICE 'Running performance comparison tests...';
    RAISE NOTICE '';

    -- Test v1 (original)
    RAISE NOTICE 'Testing v1 (original)...';
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO v1_count FROM find_matches_batch(test_markers, 5, 100, 37, NULL, false);
    end_time := clock_timestamp();
    v1_duration := EXTRACT(MILLISECONDS FROM (end_time - start_time));

    -- Test v2 (optimized)
    RAISE NOTICE 'Testing v2 (optimized)...';
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO v2_count FROM find_matches_batch_v2(test_markers, 5, 100, 37, NULL, false);
    end_time := clock_timestamp();
    v2_duration := EXTRACT(MILLISECONDS FROM (end_time - start_time));

    -- Test v3 (ultra-optimized)
    RAISE NOTICE 'Testing v3 (ultra-optimized)...';
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO v3_count FROM find_matches_batch_v3(test_markers, 5, 100, 37, NULL, false);
    end_time := clock_timestamp();
    v3_duration := EXTRACT(MILLISECONDS FROM (end_time - start_time));

    RAISE NOTICE '';
    RAISE NOTICE '=== PERFORMANCE COMPARISON ===';
    RAISE NOTICE 'v1 (original):        % ms  (% matches)', v1_duration, v1_count;
    RAISE NOTICE 'v2 (optimized):       % ms  (% matches)', v2_duration, v2_count;
    RAISE NOTICE 'v3 (ultra-optimized): % ms  (% matches)', v3_duration, v3_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Improvements:';
    RAISE NOTICE '  v2 vs v1: %x faster', ROUND(v1_duration::NUMERIC / NULLIF(v2_duration, 0), 2);
    RAISE NOTICE '  v3 vs v1: %x faster', ROUND(v1_duration::NUMERIC / NULLIF(v3_duration, 0), 2);
    RAISE NOTICE '  v3 vs v2: %x faster', ROUND(v2_duration::NUMERIC / NULLIF(v3_duration, 0), 2);
END $$;

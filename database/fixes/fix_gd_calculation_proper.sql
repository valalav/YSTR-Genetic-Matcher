-- Proper fix for GD calculation
-- Solution: SQL compares ONLY the markers that frontend sends (already filtered)
-- No LIMIT needed - frontend controls which markers to compare

-- Drop old functions
DROP FUNCTION IF EXISTS calculate_genetic_distance(JSONB, JSONB, INTEGER);
DROP FUNCTION IF EXISTS find_matches_batch(JSONB, INTEGER, INTEGER, INTEGER, VARCHAR, BOOLEAN);

-- Recreate calculate_genetic_distance WITHOUT LIMIT
-- Logic: Compare all markers from query_markers (already filtered by frontend)
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
    -- Get all keys from markers1 (query_markers) where both profiles have values
    -- No LIMIT! Frontend already sent only the markers it wants to compare
    SELECT ARRAY_AGG(k) INTO marker_keys
    FROM jsonb_object_keys(markers1) k
    WHERE markers1->>k != '' AND markers1->>k IS NOT NULL
      AND markers2->>k != '' AND markers2->>k IS NOT NULL;

    FOREACH key IN ARRAY marker_keys
    LOOP
        val1 := markers1->>key;
        val2 := markers2->>key;

        compared := compared + 1;
        IF val1 != val2 THEN
            differences := differences + 1;
        END IF;
    END LOOP;

    RETURN differences;
END;
$$;

-- Recreate find_matches_batch WITHOUT LIMIT
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
                -- Count all markers from query_markers that exist in both profiles
                -- No LIMIT! Frontend already sent only the markers to compare
                SELECT COUNT(*)
                FROM jsonb_object_keys(query_markers) k
                WHERE query_markers->>k != '' AND query_markers->>k IS NOT NULL
                  AND fp.markers->>k != '' AND fp.markers->>k IS NOT NULL
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

-- Test the fix
DO $$
DECLARE
    test_result INTEGER;
BEGIN
    RAISE NOTICE 'Testing proper GD calculation fix...';

    -- Test: Frontend sends only markers it wants to compare (DYS393, DYS576)
    -- SQL should compare ONLY these markers
    test_result := calculate_genetic_distance(
        '{"DYS393":"12","DYS576":"16"}'::JSONB,
        '{"DYS393":"12","DYS576":"17","DYS390":"22"}'::JSONB,
        37
    );

    IF test_result = 1 THEN
        RAISE NOTICE '✅ TEST PASSED: SQL compared only markers from query (distance=1)';
    ELSE
        RAISE WARNING '❌ TEST FAILED: Expected distance=1, got distance=%', test_result;
    END IF;

    -- Test: All markers identical
    test_result := calculate_genetic_distance(
        '{"DYS393":"12","DYS576":"16"}'::JSONB,
        '{"DYS393":"12","DYS576":"16","DYS390":"22"}'::JSONB,
        37
    );

    IF test_result = 0 THEN
        RAISE NOTICE '✅ TEST PASSED: Identical markers return distance=0';
    ELSE
        RAISE WARNING '❌ TEST FAILED: Expected distance=0, got distance=%', test_result;
    END IF;
END $$;

RAISE NOTICE '✅ SQL functions updated: No LIMIT, compare only markers from query_markers';

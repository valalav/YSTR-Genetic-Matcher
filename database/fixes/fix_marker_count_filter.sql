-- Fix: Filter profiles by EXACT marker count match
-- Problem: Y37 search returned profiles with only 11 markers
-- Solution: Add strict filter d.compared = actual_limit

DROP FUNCTION IF EXISTS find_matches_batch(JSONB, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN) CASCADE;

CREATE OR REPLACE FUNCTION find_matches_batch(
    query_markers JSONB,
    max_distance INTEGER DEFAULT 25,
    max_results INTEGER DEFAULT 1000,
    marker_count INTEGER DEFAULT 37,
    haplogroup_filter TEXT DEFAULT NULL,
    include_subclades BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    kit_number TEXT,
    name TEXT,
    country TEXT,
    haplogroup TEXT,
    markers JSONB,
    genetic_distance INTEGER,
    compared_markers INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    actual_limit INTEGER;
BEGIN
    -- Convert markerCount to actual position limit
    actual_limit := CASE marker_count
        WHEN 12 THEN 11
        WHEN 37 THEN 30
        WHEN 67 THEN 58
        WHEN 111 THEN 102
        ELSE marker_count
    END;

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
                FROM marker_order mo
                WHERE mo.position <= actual_limit
                  AND query_markers->>mo.marker_name IS NOT NULL
                  AND query_markers->>mo.marker_name != ''
                  AND fp.markers->>mo.marker_name IS NOT NULL
                  AND fp.markers->>mo.marker_name != ''
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
      AND d.compared = actual_limit  -- ✅ STRICT FILTER: Only profiles with EXACT marker count
    ORDER BY d.distance ASC, d.kit_number ASC
    LIMIT max_results;
END;
$$;

-- Test with IN87501 (should return only profiles with compared=30 for Y37)
SELECT
  kit_number,
  genetic_distance,
  compared_markers
FROM find_matches_batch(
  (SELECT markers FROM ystr_profiles WHERE kit_number = 'IN87501'),
  10,
  10,
  37,
  NULL,
  FALSE
)
ORDER BY genetic_distance
LIMIT 10;

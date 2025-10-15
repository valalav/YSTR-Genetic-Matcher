-- Fix GD calculation with proper FTDNA marker ordering
-- Solution: Use marker_order table to ensure deterministic marker selection

-- Drop old functions first
DROP FUNCTION IF EXISTS calculate_genetic_distance(JSONB, JSONB, INTEGER);
DROP FUNCTION IF EXISTS find_matches_batch(JSONB, INTEGER, INTEGER, INTEGER, VARCHAR, BOOLEAN);

-- Create marker order table with FTDNA standard order (102 markers = Y111 panel)
CREATE TABLE IF NOT EXISTS marker_order (
    position INTEGER PRIMARY KEY,
    marker_name VARCHAR(20) UNIQUE NOT NULL
);

-- Insert all 102 markers in FTDNA order (matching frontend constants.ts)
INSERT INTO marker_order (position, marker_name) VALUES
-- Y12 markers (positions 1-11)
(1, 'DYS393'), (2, 'DYS390'), (3, 'DYS19'), (4, 'DYS391'), (5, 'DYS385'),
(6, 'DYS426'), (7, 'DYS388'), (8, 'DYS439'), (9, 'DYS389i'), (10, 'DYS392'),
(11, 'DYS389ii'),
-- Y37 markers (positions 12-30)
(12, 'DYS458'), (13, 'DYS459'), (14, 'DYS455'), (15, 'DYS454'),
(16, 'DYS447'), (17, 'DYS437'), (18, 'DYS448'), (19, 'DYS449'), (20, 'DYS464'),
(21, 'DYS460'), (22, 'Y-GATA-H4'), (23, 'YCAII'), (24, 'DYS456'), (25, 'DYS607'),
(26, 'DYS576'), (27, 'DYS570'), (28, 'CDY'), (29, 'DYS442'), (30, 'DYS438'),
-- Y67 markers (positions 31-58)
(31, 'DYS531'), (32, 'DYS578'), (33, 'DYF395S1'), (34, 'DYS590'), (35, 'DYS537'),
(36, 'DYS641'), (37, 'DYS472'), (38, 'DYF406S1'), (39, 'DYS511'), (40, 'DYS425'),
(41, 'DYS413'), (42, 'DYS557'), (43, 'DYS594'), (44, 'DYS436'), (45, 'DYS490'),
(46, 'DYS534'), (47, 'DYS450'), (48, 'DYS444'), (49, 'DYS481'), (50, 'DYS520'),
(51, 'DYS446'), (52, 'DYS617'), (53, 'DYS568'), (54, 'DYS487'), (55, 'DYS572'),
(56, 'DYS640'), (57, 'DYS492'), (58, 'DYS565'),
-- Y111 markers (positions 59-102)
(59, 'DYS710'), (60, 'DYS485'),
(61, 'DYS632'), (62, 'DYS495'), (63, 'DYS540'), (64, 'DYS714'), (65, 'DYS716'),
(66, 'DYS717'), (67, 'DYS505'), (68, 'DYS556'), (69, 'DYS549'), (70, 'DYS589'),
(71, 'DYS522'), (72, 'DYS494'), (73, 'DYS533'), (74, 'DYS636'), (75, 'DYS575'),
(76, 'DYS638'), (77, 'DYS462'), (78, 'DYS452'), (79, 'DYS445'), (80, 'Y-GATA-A10'),
(81, 'DYS463'), (82, 'DYS441'), (83, 'Y-GGAAT-1B07'), (84, 'DYS525'), (85, 'DYS712'),
(86, 'DYS593'), (87, 'DYS650'), (88, 'DYS532'), (89, 'DYS715'), (90, 'DYS504'),
(91, 'DYS513'), (92, 'DYS561'), (93, 'DYS552'), (94, 'DYS726'), (95, 'DYS635'),
(96, 'DYS587'), (97, 'DYS643'), (98, 'DYS497'), (99, 'DYS510'), (100, 'DYS434'),
(101, 'DYS461'), (102, 'DYS435')
ON CONFLICT (position) DO NOTHING;

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_marker_order_position ON marker_order(position);
CREATE INDEX IF NOT EXISTS idx_marker_order_name ON marker_order(marker_name);

-- Recreate calculate_genetic_distance with proper marker ordering
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
    actual_limit INTEGER;
BEGIN
    -- Convert markerCount to actual position limit
    -- Y12 = 11 markers, Y37 = 30 markers, Y67 = 58 markers, Y111 = 102 markers
    actual_limit := CASE marker_count
        WHEN 12 THEN 11
        WHEN 37 THEN 30
        WHEN 67 THEN 58
        WHEN 111 THEN 102
        ELSE marker_count
    END;

    -- Get markers in FTDNA order using marker_order table
    SELECT ARRAY_AGG(mo.marker_name ORDER BY mo.position) INTO marker_keys
    FROM marker_order mo
    WHERE mo.position <= actual_limit
      AND markers1->>mo.marker_name IS NOT NULL
      AND markers1->>mo.marker_name != ''
      AND markers2->>mo.marker_name IS NOT NULL
      AND markers2->>mo.marker_name != '';

    -- Fallback to alphabetical order if marker_order is empty
    IF marker_keys IS NULL OR array_length(marker_keys, 1) = 0 THEN
        SELECT ARRAY_AGG(k ORDER BY k) INTO marker_keys
        FROM (
            SELECT k
            FROM jsonb_object_keys(markers1) k
            WHERE markers1->>k != '' AND markers1->>k IS NOT NULL
              AND markers2->>k != '' AND markers2->>k IS NOT NULL
            ORDER BY k
            LIMIT actual_limit
        ) subq;
    END IF;

    -- Compare markers
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

-- Recreate find_matches_batch with proper compared_markers counting
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
            fp.markers,  -- Return ALL markers from profile
            calculate_genetic_distance(query_markers, fp.markers, marker_count) as distance,
            (
                -- Count compared markers using marker_order table
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
    ORDER BY d.distance ASC, d.kit_number ASC
    LIMIT max_results;
END;
$$;

-- Test the fix with DYS576 case
DO $$
DECLARE
    test_result INTEGER;
    test_compared INTEGER;
BEGIN
    RAISE NOTICE 'Testing marker order fix...';

    -- Test: IN87501 (DYS576=17) vs 55520 (DYS576=16)
    -- They should have distance=1 because DYS576 is at position 26 (within Y37)
    test_result := calculate_genetic_distance(
        '{"DYS393":"12","DYS390":"22","DYS19":"15","DYS576":"17"}'::JSONB,
        '{"DYS393":"12","DYS390":"22","DYS19":"15","DYS576":"16","DYS391":"10"}'::JSONB,
        37
    );

    IF test_result = 1 THEN
        RAISE NOTICE '✅ TEST PASSED: DYS576 difference detected (distance=1)';
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

RAISE NOTICE '✅ SQL functions updated with marker_order table';
RAISE NOTICE '✅ Y12=11 markers, Y37=30 markers, Y67=58 markers, Y111=102 markers';

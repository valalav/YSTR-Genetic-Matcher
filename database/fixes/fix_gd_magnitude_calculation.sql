-- Fix GD calculation to match frontend logic (magnitude-based)
-- Problem: SQL counts all differences as 1, but should calculate magnitude (0, 1, or 2)
-- Example: DYS439: 13 vs 11 should contribute 2, not 1

-- Drop old function
DROP FUNCTION IF EXISTS calculate_genetic_distance(JSONB, JSONB, INTEGER);

-- Recreate with magnitude-based calculation
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
    is_palindrome BOOLEAN;
    num1 INTEGER;
    num2 INTEGER;
    magnitude INTEGER;
BEGIN
    -- Convert markerCount to actual position limit
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

    -- Compare markers with magnitude calculation
    FOREACH key IN ARRAY marker_keys
    LOOP
        val1 := markers1->>key;
        val2 := markers2->>key;

        compared := compared + 1;

        IF val1 = val2 THEN
            -- Identical - no difference
            CONTINUE;
        END IF;

        -- Check if marker is palindromic (contains dash or known palindrome)
        -- Palindromic markers: DYS385, DYS464, DYS459, YCAII, CDY, DYF395S1, DYS413, DYF387S1, DYF404S1
        is_palindrome := (
            val1 LIKE '%-%' OR
            val2 LIKE '%-%' OR
            key IN ('DYS385', 'DYS464', 'DYS459', 'YCAII', 'CDY', 'DYF395S1', 'DYS413', 'DYF387S1', 'DYF404S1')
        );

        IF is_palindrome THEN
            -- Palindromic markers: always count as 1 if different
            differences := differences + 1;
        ELSE
            -- Standard markers: try to parse as integers
            BEGIN
                num1 := val1::INTEGER;
                num2 := val2::INTEGER;

                -- Calculate magnitude, capped at 2 (FTDNA standard)
                magnitude := LEAST(ABS(num1 - num2), 2);
                differences := differences + magnitude;

            EXCEPTION WHEN OTHERS THEN
                -- Non-numeric values: count as 1 if different
                differences := differences + 1;
            END;
        END IF;
    END LOOP;

    RETURN differences;
END;
$$;

-- Test with DYS439 case: 13 vs 11 should contribute 2 (not 1)
DO $$
DECLARE
    test_result INTEGER;
BEGIN
    RAISE NOTICE 'Testing magnitude-based GD calculation...';

    -- Test 1: DYS439: 13 vs 11 should be 2
    test_result := calculate_genetic_distance(
        '{"DYS439":"13"}'::JSONB,
        '{"DYS439":"11"}'::JSONB,
        37
    );

    IF test_result = 2 THEN
        RAISE NOTICE '✅ TEST 1 PASSED: DYS439 (13 vs 11) = distance 2';
    ELSE
        RAISE WARNING '❌ TEST 1 FAILED: Expected distance=2, got distance=%', test_result;
    END IF;

    -- Test 2: Palindrome DYS385: 13-16 vs 14-16 should be 1
    test_result := calculate_genetic_distance(
        '{"DYS385":"13-16"}'::JSONB,
        '{"DYS385":"14-16"}'::JSONB,
        37
    );

    IF test_result = 1 THEN
        RAISE NOTICE '✅ TEST 2 PASSED: DYS385 palindrome = distance 1';
    ELSE
        RAISE WARNING '❌ TEST 2 FAILED: Expected distance=1, got distance=%', test_result;
    END IF;

    -- Test 3: Large difference capped at 2: 20 vs 10 should be 2 (not 10)
    test_result := calculate_genetic_distance(
        '{"DYS390":"20"}'::JSONB,
        '{"DYS390":"10"}'::JSONB,
        37
    );

    IF test_result = 2 THEN
        RAISE NOTICE '✅ TEST 3 PASSED: Large difference (20 vs 10) capped at 2';
    ELSE
        RAISE WARNING '❌ TEST 3 FAILED: Expected distance=2, got distance=%', test_result;
    END IF;

    -- Test 4: Identical markers should be 0
    test_result := calculate_genetic_distance(
        '{"DYS393":"12"}'::JSONB,
        '{"DYS393":"12"}'::JSONB,
        37
    );

    IF test_result = 0 THEN
        RAISE NOTICE '✅ TEST 4 PASSED: Identical markers = distance 0';
    ELSE
        RAISE WARNING '❌ TEST 4 FAILED: Expected distance=0, got distance=%', test_result;
    END IF;

    -- Test 5: Multiple markers (2+1+1 = 4)
    test_result := calculate_genetic_distance(
        '{"DYS439":"13", "DYS385":"13-16", "DYS393":"13"}'::JSONB,
        '{"DYS439":"11", "DYS385":"14-16", "DYS393":"12"}'::JSONB,
        37
    );

    IF test_result = 4 THEN
        RAISE NOTICE '✅ TEST 5 PASSED: Multiple markers (2+1+1) = distance 4';
    ELSE
        RAISE WARNING '❌ TEST 5 FAILED: Expected distance=4, got distance=%', test_result;
    END IF;
END $$;

RAISE NOTICE '✅ SQL function updated with magnitude-based GD calculation';
RAISE NOTICE '✅ Standard markers: LEAST(ABS(val1 - val2), 2)';
RAISE NOTICE '✅ Palindromic markers: 1 if different';

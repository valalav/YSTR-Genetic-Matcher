-- Fix calculate_marker_distance to use FTDNA standard method
-- Each marker difference is capped at 2 (FTDNA standard)

DROP FUNCTION IF EXISTS calculate_marker_distance(TEXT, TEXT);

CREATE OR REPLACE FUNCTION calculate_marker_distance(val1 TEXT, val2 TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    num1 INTEGER;
    num2 INTEGER;
BEGIN
    -- Handle NULL or empty values
    IF val1 IS NULL OR val2 IS NULL OR val1 = '' OR val2 = '' THEN
        RETURN 0;
    END IF;

    -- If values match exactly, distance is 0
    IF val1 = val2 THEN
        RETURN 0;
    END IF;

    -- For palindromic markers (contain dash), count as 1 difference
    -- This is standard FTDNA approach - palindromes count as single markers
    IF val1 LIKE '%-%' OR val2 LIKE '%-%' THEN
        RETURN 1;
    END IF;

    -- Try to parse as integers for numeric comparison
    BEGIN
        num1 := val1::INTEGER;
        num2 := val2::INTEGER;

        -- Return absolute difference, capped at 2 (FTDNA standard)
        RETURN LEAST(ABS(num2 - num1), 2);
    EXCEPTION WHEN OTHERS THEN
        -- If not numeric, just return 1 (different)
        RETURN 1;
    END;
END;
$$;

COMMENT ON FUNCTION calculate_marker_distance(TEXT, TEXT) IS
'Calculate FTDNA-standard distance between two marker values.
Returns 0 if equal, absolute difference capped at 2 for numeric markers, 1 for palindromic markers.';

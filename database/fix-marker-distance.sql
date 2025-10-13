-- Fix calculate_marker_distance to match calculate_genetic_distance behavior
-- Palindromic markers should count as 1 difference if ANY component differs

DROP FUNCTION IF EXISTS calculate_marker_distance(TEXT, TEXT);

CREATE OR REPLACE FUNCTION calculate_marker_distance(val1 TEXT, val2 TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Handle NULL or empty values
    IF val1 IS NULL OR val2 IS NULL OR val1 = '' OR val2 = '' THEN
        RETURN 0;
    END IF;

    -- Simple string comparison (matches calculate_genetic_distance logic)
    -- If values match exactly, distance is 0
    -- If values differ, distance is 1
    IF val1 = val2 THEN
        RETURN 0;
    ELSE
        RETURN 1;
    END IF;
END;
$$;

COMMENT ON FUNCTION calculate_marker_distance(TEXT, TEXT) IS 'Calculate distance between two marker values. Returns 0 if equal, 1 if different. Matches calculate_genetic_distance logic.';

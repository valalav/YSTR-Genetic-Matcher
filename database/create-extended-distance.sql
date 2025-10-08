CREATE OR REPLACE FUNCTION calculate_marker_distance_extended(val1 TEXT, val2 TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    parts1 TEXT[];
    parts2 TEXT[];
    num1 INTEGER;
    num2 INTEGER;
    total_diff INTEGER := 0;
    i INTEGER;
BEGIN
    IF val1 IS NULL OR val2 IS NULL OR val1 = '' OR val2 = '' THEN
        RETURN 0;
    END IF;

    IF val1 LIKE '%-%' OR val2 LIKE '%-%' THEN
        parts1 := string_to_array(val1, '-');
        parts2 := string_to_array(val2, '-');

        IF array_length(parts1, 1) != array_length(parts2, 1) THEN
            RETURN array_length(parts1, 1);
        END IF;

        FOR i IN 1..array_length(parts1, 1) LOOP
            BEGIN
                num1 := parts1[i]::INTEGER;
                num2 := parts2[i]::INTEGER;
                total_diff := total_diff + ABS(num2 - num1);
            EXCEPTION WHEN OTHERS THEN
                total_diff := total_diff + 1;
            END;
        END LOOP;

        RETURN total_diff;
    ELSE
        BEGIN
            num1 := val1::INTEGER;
            num2 := val2::INTEGER;
            RETURN ABS(num2 - num1);
        EXCEPTION WHEN OTHERS THEN
            IF val1 = val2 THEN
                RETURN 0;
            ELSE
                RETURN 1;
            END IF;
        END;
    END IF;
END;
$$;

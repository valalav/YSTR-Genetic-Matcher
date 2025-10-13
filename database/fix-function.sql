-- Fix the calculate_genetic_distance function to handle NULL array case
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
    -- Get intersection of marker keys (only common markers with valid values)
    SELECT ARRAY_AGG(k) INTO marker_keys
    FROM (
        SELECT k
        FROM jsonb_object_keys(markers1) k
        WHERE markers1->>k != '' AND markers1->>k IS NOT NULL
          AND markers2->>k != '' AND markers2->>k IS NOT NULL
        LIMIT marker_count
    ) common_keys;

    -- Handle case when no common markers found
    IF marker_keys IS NULL OR array_length(marker_keys, 1) IS NULL THEN
        RETURN 999; -- Return high value when no comparison possible
    END IF;

    FOREACH key IN ARRAY marker_keys
    LOOP
        val1 := markers1->>key;
        val2 := markers2->>key;

        -- Values are already validated in the selection query above
        compared := compared + 1;
        IF val1 != val2 THEN
            differences := differences + 1;
        END IF;
    END LOOP;

    RETURN differences;
END;
$$;

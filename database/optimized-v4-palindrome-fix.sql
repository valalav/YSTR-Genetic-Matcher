-- V4: Fixed palindrome/multi-value marker distance calculation
-- Properly handles markers like CDY:"33-34", DYS385:"12-15", DYS464:"11-12-12-16"

CREATE OR REPLACE FUNCTION calculate_marker_distance(val1 TEXT, val2 TEXT)
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
    -- Handle NULL or empty values
    IF val1 IS NULL OR val2 IS NULL OR val1 = '' OR val2 = '' THEN
        RETURN 0;
    END IF;

    -- Check if values contain dashes (palindrome/multi-value markers)
    IF val1 LIKE '%-%' OR val2 LIKE '%-%' THEN
        -- Split by dash
        parts1 := string_to_array(val1, '-');
        parts2 := string_to_array(val2, '-');

        -- If different number of components, treat as complete mismatch
        IF array_length(parts1, 1) != array_length(parts2, 1) THEN
            RETURN 1;
        END IF;

        -- Calculate sum of differences for each component (min 2 per component)
        FOR i IN 1..array_length(parts1, 1) LOOP
            BEGIN
                num1 := parts1[i]::INTEGER;
                num2 := parts2[i]::INTEGER;
                total_diff := total_diff + LEAST(ABS(num2 - num1), 2);
            EXCEPTION WHEN OTHERS THEN
                -- If conversion fails, count as difference
                total_diff := total_diff + 1;
            END;
        END LOOP;

        -- Return minimum of total_diff and 2 (to match IndexedDB logic)
        RETURN LEAST(total_diff, 2);
    ELSE
        -- Simple numeric comparison
        BEGIN
            num1 := val1::INTEGER;
            num2 := val2::INTEGER;
            RETURN LEAST(ABS(num2 - num1), 2);
        EXCEPTION WHEN OTHERS THEN
            -- If not numeric, do string comparison
            IF val1 = val2 THEN
                RETURN 0;
            ELSE
                RETURN 1;
            END IF;
        END;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION find_matches_batch_v4(
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
            WHEN haplogroup_filter IS NULL THEN 50000
            ELSE 100000
        END
    ),
    distances AS (
        SELECT
            fp.kit_number,
            fp.name,
            fp.country,
            fp.haplogroup,
            fp.markers,
            -- FIXED: Use proper distance calculation for palindromes
            (
                SELECT SUM(calculate_marker_distance(query_markers->>k, fp.markers->>k))::INTEGER
                FROM unnest(query_marker_keys) k
                WHERE fp.markers->>k IS NOT NULL
                  AND fp.markers->>k != ''
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
      AND d.compared >= min_required_matches
    ORDER BY d.distance ASC, d.kit_number ASC
    LIMIT max_results;
END;
$$;

-- Add comment
COMMENT ON FUNCTION find_matches_batch_v4 IS 'Fixed version that properly calculates distance for multi-value markers (palindromes)';

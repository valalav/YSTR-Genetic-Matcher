-- Version 6: Dual distance calculation (standard for filtering, extended for display)
-- Standard distance: limited to ±2 per marker, max 2 for palindromes (for filtering)
-- Extended distance: unlimited, shows real differences (for display)

CREATE OR REPLACE FUNCTION find_matches_batch_v6(
    query_markers JSONB,
    max_distance INTEGER DEFAULT 25,
    max_results INTEGER DEFAULT 1000,
    marker_count INTEGER DEFAULT 37,
    haplogroup_filter VARCHAR DEFAULT NULL,
    include_subclades BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
    kit_number VARCHAR,
    name VARCHAR,
    country VARCHAR,
    haplogroup VARCHAR,
    markers JSONB,
    genetic_distance INTEGER,           -- Standard GD (для фильтрации, с ограничениями)
    genetic_distance_extended INTEGER,  -- Extended GD (для отображения, без ограничений)
    compared_markers INTEGER,
    percent_identical NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
    panel_markers TEXT[];
    query_marker_keys TEXT[];
    min_required_markers INTEGER;
    panel_min_threshold INTEGER;
BEGIN
    -- Get markers for the selected panel
    SELECT mp.markers INTO panel_markers
    FROM marker_panels mp
    WHERE mp.panel_size = marker_count;

    -- If panel not found, use default 37
    IF panel_markers IS NULL THEN
        SELECT mp.markers INTO panel_markers
        FROM marker_panels mp
        WHERE mp.panel_size = 37;
    END IF;

    -- Extract query markers that are in the panel AND have values
    SELECT ARRAY_AGG(k) INTO query_marker_keys
    FROM unnest(panel_markers) k
    WHERE query_markers->>k IS NOT NULL
      AND query_markers->>k != '';

    -- If no valid markers, return empty
    IF query_marker_keys IS NULL OR array_length(query_marker_keys, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Calculate minimum required markers (80% of query markers in panel)
    min_required_markers := CEIL(array_length(query_marker_keys, 1) * 0.8);

    -- Also require profiles to have at least 80% of the panel markers
    panel_min_threshold := CEIL(array_length(panel_markers, 1) * 0.8);

    RETURN QUERY
    WITH filtered_profiles AS (
        SELECT
            p.kit_number,
            p.name,
            p.country,
            p.haplogroup,
            p.markers,
            -- Count how many panel markers this profile has
            (
                SELECT COUNT(*)::INTEGER
                FROM unnest(panel_markers) pm
                WHERE p.markers->>pm IS NOT NULL AND p.markers->>pm != ''
            ) as profile_panel_marker_count
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
            fp.profile_panel_marker_count,
            -- STANDARD genetic distance (с ограничениями, для фильтрации)
            (
                SELECT SUM(calculate_marker_distance(query_markers->>k, fp.markers->>k))::INTEGER
                FROM unnest(query_marker_keys) k
                WHERE fp.markers->>k IS NOT NULL
                  AND fp.markers->>k != ''
            ) as distance_standard,
            -- EXTENDED genetic distance (без ограничений, для отображения)
            (
                SELECT SUM(calculate_marker_distance_extended(query_markers->>k, fp.markers->>k))::INTEGER
                FROM unnest(query_marker_keys) k
                WHERE fp.markers->>k IS NOT NULL
                  AND fp.markers->>k != ''
            ) as distance_extended,
            -- Count compared markers
            (
                SELECT COUNT(*)::INTEGER
                FROM unnest(query_marker_keys) k
                WHERE fp.markers->>k IS NOT NULL AND fp.markers->>k != ''
            ) as compared,
            -- Count identical markers
            (
                SELECT COUNT(*)::INTEGER
                FROM unnest(query_marker_keys) k
                WHERE fp.markers->>k IS NOT NULL
                  AND fp.markers->>k != ''
                  AND calculate_marker_distance(query_markers->>k, fp.markers->>k) = 0
            ) as identical
        FROM filtered_profiles fp
        -- CRITICAL: Only include profiles with enough panel markers (80% of panel)
        WHERE fp.profile_panel_marker_count >= panel_min_threshold
    )
    SELECT
        d.kit_number,
        d.name,
        d.country,
        d.haplogroup,
        d.markers,
        d.distance_standard as genetic_distance,
        d.distance_extended as genetic_distance_extended,
        d.compared as compared_markers,
        CASE
            WHEN d.compared > 0 THEN ROUND((d.identical::NUMERIC / d.compared) * 100, 1)
            ELSE 0
        END as percent_identical
    FROM distances d
    WHERE
        d.compared >= min_required_markers
        -- ВАЖНО: Фильтруем по STANDARD distance (с ограничениями)
        AND d.distance_standard <= max_distance
    ORDER BY d.distance_standard ASC, d.compared DESC
    LIMIT max_results;
END;
$$;

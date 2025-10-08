-- V5: Improved marker panel filtering
-- Ensures profiles have sufficient markers from the selected panel (80% minimum)
-- Fixes the issue where profiles with fewer markers get better match percentage

-- Standard marker panels (matching frontend constants)
CREATE TABLE IF NOT EXISTS marker_panels (
    panel_size INTEGER PRIMARY KEY,
    markers TEXT[]
);

-- Insert standard panels (Y12, Y25, Y37, Y67, Y111)
-- These must match the constants in frontend src/utils/constants.ts
INSERT INTO marker_panels (panel_size, markers) VALUES
(12, ARRAY['DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392', 'DYS389ii', 'DYS458']),
(25, ARRAY['DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392', 'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607']),
(37, ARRAY['DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392', 'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578', 'DYF395S1', 'DYS590', 'DYS537', 'DYS641']),
(67, ARRAY['DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392', 'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578', 'DYF395S1', 'DYS590', 'DYS537', 'DYS641', 'DYS472', 'DYF406S1', 'DYS511', 'DYS425', 'DYS413', 'DYS557', 'DYS594', 'DYS436', 'DYS490', 'DYS534', 'DYS450', 'DYS444', 'DYS481', 'DYS520', 'DYS446', 'DYS617', 'DYS568', 'DYS487', 'DYS572', 'DYS640', 'DYS492', 'DYS565', 'DYS710', 'DYS485', 'DYS632', 'DYS495', 'DYS540', 'DYS714', 'DYS716', 'DYS717']),
(111, ARRAY['DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385', 'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392', 'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454', 'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464', 'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607', 'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438', 'DYS531', 'DYS578', 'DYF395S1', 'DYS590', 'DYS537', 'DYS641', 'DYS472', 'DYF406S1', 'DYS511', 'DYS425', 'DYS413', 'DYS557', 'DYS594', 'DYS436', 'DYS490', 'DYS534', 'DYS450', 'DYS444', 'DYS481', 'DYS520', 'DYS446', 'DYS617', 'DYS568', 'DYS487', 'DYS572', 'DYS640', 'DYS492', 'DYS565', 'DYS710', 'DYS485', 'DYS632', 'DYS495', 'DYS540', 'DYS714', 'DYS716', 'DYS717', 'DYS505', 'DYS556', 'DYS549', 'DYS589', 'DYS522', 'DYS494', 'DYS533', 'DYS636', 'DYS575', 'DYS638', 'DYS462', 'DYS452', 'DYS445', 'Y-GATA-A10', 'DYS463', 'DYS441', 'Y-GGAAT-1B07', 'DYS525', 'DYS712', 'DYS593', 'DYS650', 'DYS532', 'DYS715', 'DYS504', 'DYS513', 'DYS561', 'DYS552', 'DYS726', 'DYS635', 'DYS587', 'DYS643', 'DYS497', 'DYS510', 'DYS434', 'DYS461', 'DYS435', 'DYS596', 'DYF404S1', 'DYF387S1', 'DYS627', 'DYS527', 'DYS518'])
ON CONFLICT (panel_size) DO UPDATE
SET markers = EXCLUDED.markers;

-- Drop old function
DROP FUNCTION IF EXISTS find_matches_batch_v5(JSONB, INTEGER, INTEGER, INTEGER, VARCHAR, BOOLEAN);

CREATE OR REPLACE FUNCTION find_matches_batch_v5(
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
    compared_markers INTEGER,
    percent_identical NUMERIC
)
LANGUAGE plpgsql
VOLATILE
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
            -- Quick marker overlap check using GIN (at least one common marker)
            AND p.markers ?| query_marker_keys
        -- Limit early to avoid scanning too many rows
        -- Увеличен лимит чтобы охватить всю базу данных
        LIMIT CASE
            WHEN haplogroup_filter IS NULL THEN 500000
            ELSE 500000
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
            -- Calculate genetic distance
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
        d.distance,
        d.compared,
        ROUND((d.identical::NUMERIC / NULLIF(d.compared, 0)::NUMERIC) * 100, 1) as percent_identical
    FROM distances d
    WHERE d.distance <= max_distance
      AND d.compared >= min_required_markers
    ORDER BY d.distance ASC, d.compared DESC, d.kit_number ASC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION find_matches_batch_v5 IS
'V5: Improved panel filtering - requires profiles to have 80% of panel markers.
Fixes issue where profiles with fewer markers got artificially high match percentages.
Now properly compares only within the selected marker panel (12, 25, 37, 67, 111).';

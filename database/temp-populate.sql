INSERT INTO haplogroup_databases (haplogroup, total_profiles, avg_markers, description, status)
SELECT
    COALESCE(haplogroup, 'Unknown') as haplogroup,
    COUNT(*) as total_profiles,
    AVG((SELECT COUNT(*) FROM jsonb_object_keys(markers)))::DECIMAL(5,2) as avg_markers,
    CASE
        WHEN haplogroup LIKE 'I-%' THEN 'I haplogroup family'
        WHEN haplogroup LIKE 'R-%' THEN 'R haplogroup family'
        WHEN haplogroup LIKE 'E-%' THEN 'E haplogroup family'
        WHEN haplogroup LIKE 'J-%' THEN 'J haplogroup family'
        WHEN haplogroup LIKE 'G-%' THEN 'G haplogroup family'
        WHEN haplogroup LIKE 'N-%' THEN 'N haplogroup family'
        ELSE 'Other haplogroups'
    END as description,
    'active' as status
FROM ystr_profiles
WHERE haplogroup IS NOT NULL AND haplogroup <> ''
GROUP BY haplogroup
ON CONFLICT (haplogroup) DO UPDATE
SET
    total_profiles = EXCLUDED.total_profiles,
    avg_markers = EXCLUDED.avg_markers,
    updated_at = CURRENT_TIMESTAMP;

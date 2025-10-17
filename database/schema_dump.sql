--
-- PostgreSQL database dump
--

\restrict Hdxq15Jko0coxMcM9IWf8PYdczY1YRPyXFOfsabyNvgdcsWg2f9eOatVaqVE7uR

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gin; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA public;


--
-- Name: EXTENSION btree_gin; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gin IS 'support for indexing common datatypes in GIN';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: bulk_insert_profiles(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_insert_profiles(profiles_data jsonb) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    inserted_count INTEGER := 0;
    profile JSONB;
BEGIN
    FOR profile IN SELECT jsonb_array_elements(profiles_data)
    LOOP
        INSERT INTO ystr_profiles (kit_number, name, country, haplogroup, markers)
        VALUES (
            profile->>'kit_number',
            profile->>'name',
            profile->>'country',
            profile->>'haplogroup',
            profile->'markers'
        )
        ON CONFLICT (kit_number)
        DO UPDATE SET
            name = EXCLUDED.name,
            country = EXCLUDED.country,
            haplogroup = EXCLUDED.haplogroup,
            markers = EXCLUDED.markers,
            updated_at = CURRENT_TIMESTAMP;

        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN inserted_count;
END;
$$;


--
-- Name: calculate_genetic_distance(jsonb, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_genetic_distance(markers1 jsonb, markers2 jsonb, marker_count integer DEFAULT 37) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
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
            CONTINUE;
        END IF;

        -- Check if marker is palindromic
        is_palindrome := (
            val1 LIKE '%-%' OR
            val2 LIKE '%-%' OR
            key IN ('DYS385', 'DYS464', 'DYS459', 'YCAII', 'CDY', 'DYF395S1', 'DYS413', 'DYF387S1', 'DYF404S1')
        );

        IF is_palindrome THEN
            differences := differences + 1;
        ELSE
            BEGIN
                num1 := val1::INTEGER;
                num2 := val2::INTEGER;
                magnitude := LEAST(ABS(num1 - num2), 2);
                differences := differences + magnitude;
            EXCEPTION WHEN OTHERS THEN
                differences := differences + 1;
            END;
        END IF;
    END LOOP;

    RETURN differences;
END;
$$;


--
-- Name: calculate_marker_distance(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_marker_distance(val1 text, val2 text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    num1 INTEGER;
    num2 INTEGER;
    values1 TEXT[];
    values2 TEXT[];
    total_dist INTEGER := 0;
    i INTEGER;
    v1 TEXT;
    v2 TEXT;
BEGIN
    -- Handle NULL or empty values
    IF val1 IS NULL OR val2 IS NULL OR val1 = '' OR val2 = '' THEN
        RETURN 0;
    END IF;

    -- If values match exactly, distance is 0
    IF val1 = val2 THEN
        RETURN 0;
    END IF;

    -- For palindromic markers (contain dash), calculate sum of differences
    IF val1 LIKE '%-%' OR val2 LIKE '%-%' THEN
        -- Split both values by dash
        values1 := string_to_array(val1, '-');
        values2 := string_to_array(val2, '-');
        
        -- Calculate distance for each pair
        FOR i IN 1..GREATEST(array_length(values1, 1), array_length(values2, 1))
        LOOP
            v1 := values1[i];
            v2 := values2[i];
            
            -- Skip if either value is missing
            IF v1 IS NULL OR v2 IS NULL OR v1 = '' OR v2 = '' THEN
                CONTINUE;
            END IF;
            
            -- Try to parse as integers
            BEGIN
                num1 := v1::INTEGER;
                num2 := v2::INTEGER;
                
                -- Add absolute difference, capped at 2 per value
                total_dist := total_dist + LEAST(ABS(num2 - num1), 2);
            EXCEPTION WHEN OTHERS THEN
                -- If not numeric, count as 1 difference
                IF v1 != v2 THEN
                    total_dist := total_dist + 1;
                END IF;
            END;
        END LOOP;
        
        RETURN total_dist;
    END IF;

    -- For standard (non-palindromic) markers
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


--
-- Name: FUNCTION calculate_marker_distance(val1 text, val2 text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_marker_distance(val1 text, val2 text) IS 'Calculate real distance between two marker values.
For palindromic markers (with dashes), calculates sum of differences for each value.
Example: CDY "35-36" vs "36-37" = (|35-36| + |36-37|) = 1 + 1 = 2';


--
-- Name: find_matches_batch(jsonb, integer, integer, integer, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_matches_batch(query_markers jsonb, max_distance integer DEFAULT 25, max_results integer DEFAULT 1000, marker_count integer DEFAULT 37, haplogroup_filter text DEFAULT NULL::text, include_subclades boolean DEFAULT false) RETURNS TABLE(kit_number text, name text, country text, haplogroup text, markers jsonb, genetic_distance integer, compared_markers integer)
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
            fp.markers,
            calculate_genetic_distance(query_markers, fp.markers, marker_count) as distance,
            (
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
      AND d.compared = actual_limit  -- ✅ STRICT FILTER: Only profiles with EXACT marker count
    ORDER BY d.distance ASC, d.kit_number ASC
    LIMIT max_results;
END;
$$;


--
-- Name: find_matches_batch_v5(jsonb, integer, integer, integer, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_matches_batch_v5(query_markers jsonb, max_distance integer DEFAULT 25, max_results integer DEFAULT 1000, marker_count integer DEFAULT 37, haplogroup_filter text DEFAULT NULL::text, include_subclades boolean DEFAULT false) RETURNS TABLE(kit_number text, name text, country text, haplogroup text, markers jsonb, genetic_distance integer, compared_markers integer)
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

    -- Calculate minimum required markers (95% of query markers in panel)
    min_required_markers := CEIL(array_length(query_marker_keys, 1) * 0.95);

    -- Also require profiles to have at least 95% of the panel markers
    panel_min_threshold := CEIL(array_length(panel_markers, 1) * 0.95);

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
            ) as compared
        FROM filtered_profiles fp
        -- CRITICAL: Only include profiles with enough panel markers (95% of panel)
        WHERE fp.profile_panel_marker_count >= panel_min_threshold
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
      AND d.compared >= min_required_markers
    ORDER BY d.distance ASC, d.compared DESC, d.kit_number ASC
    LIMIT max_results;
END;
$$;


--
-- Name: FUNCTION find_matches_batch_v5(query_markers jsonb, max_distance integer, max_results integer, marker_count integer, haplogroup_filter text, include_subclades boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_matches_batch_v5(query_markers jsonb, max_distance integer, max_results integer, marker_count integer, haplogroup_filter text, include_subclades boolean) IS 'V5: Improved panel filtering - requires profiles to have 95% of panel markers.
Uses TEXT types to match ystr_profiles table structure.';


--
-- Name: get_api_key_permissions(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_api_key_permissions(key_hash_param character varying) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
    perms JSONB;
BEGIN
    SELECT permissions INTO perms
    FROM api_keys
    WHERE key_hash = key_hash_param
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

    RETURN COALESCE(perms, '{}'::jsonb);
END;
$$;


--
-- Name: is_api_key_valid(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_api_key_valid(key_hash_param character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    key_record RECORD;
BEGIN
    SELECT * INTO key_record
    FROM api_keys
    WHERE key_hash = key_hash_param
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP);

    RETURN FOUND;
END;
$$;


--
-- Name: log_audit(integer, character varying, character varying, character varying, jsonb, jsonb, character varying, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit(p_api_key_id integer, p_operation character varying, p_table_name character varying, p_record_id character varying, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb, p_ip_address character varying DEFAULT NULL::character varying, p_user_agent text DEFAULT NULL::text, p_success boolean DEFAULT true, p_error_message text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    audit_id INTEGER;
BEGIN
    INSERT INTO audit_log (
        api_key_id,
        operation,
        table_name,
        record_id,
        old_data,
        new_data,
        ip_address,
        user_agent,
        success,
        error_message
    ) VALUES (
        p_api_key_id,
        p_operation,
        p_table_name,
        p_record_id,
        p_old_data,
        p_new_data,
        p_ip_address,
        p_user_agent,
        p_success,
        p_error_message
    )
    RETURNING id INTO audit_id;

    RETURN audit_id;
END;
$$;


--
-- Name: refresh_marker_statistics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_marker_statistics() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY marker_statistics;
    RETURN NULL;
END;
$$;


--
-- Name: update_api_key_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_api_key_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.api_key_id IS NOT NULL THEN
        UPDATE api_keys
        SET last_used_at = CURRENT_TIMESTAMP,
            usage_count = usage_count + 1
        WHERE id = NEW.api_key_id;
    END IF;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    key_hash character varying(64) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true,
    last_used_at timestamp without time zone,
    usage_count integer DEFAULT 0
);


--
-- Name: TABLE api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.api_keys IS 'Stores API keys for authenticated access to the system';


--
-- Name: COLUMN api_keys.key_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.key_hash IS 'SHA-256 hash of the API key';


--
-- Name: COLUMN api_keys.permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.api_keys.permissions IS 'JSONB object with permission flags (e.g. {"samples.create": true})';


--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    api_key_id integer,
    operation character varying(50) NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id character varying(100),
    old_data jsonb,
    new_data jsonb,
    ip_address character varying(45),
    user_agent text,
    success boolean DEFAULT true,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE audit_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.audit_log IS 'Complete audit trail of all data modifications';


--
-- Name: COLUMN audit_log.old_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_log.old_data IS 'JSONB snapshot of data before modification';


--
-- Name: COLUMN audit_log.new_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.audit_log.new_data IS 'JSONB snapshot of data after modification';


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: audit_log_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.audit_log_summary AS
 SELECT al.id,
    al.created_at,
    al.operation,
    al.table_name,
    al.record_id,
    al.success,
    ak.name AS api_key_name,
    ak.id AS api_key_id,
    al.ip_address
   FROM (public.audit_log al
     LEFT JOIN public.api_keys ak ON ((al.api_key_id = ak.id)))
  ORDER BY al.created_at DESC;


--
-- Name: haplogroups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.haplogroups (
    id integer NOT NULL,
    haplogroup character varying(50) NOT NULL,
    parent_haplogroup character varying(50),
    level integer DEFAULT 0 NOT NULL
);


--
-- Name: haplogroups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.haplogroups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: haplogroups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.haplogroups_id_seq OWNED BY public.haplogroups.id;


--
-- Name: marker_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marker_order (
    "position" integer NOT NULL,
    marker_name character varying(20) NOT NULL
);


--
-- Name: marker_panels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marker_panels (
    panel_size integer NOT NULL,
    markers text[]
);


--
-- Name: ystr_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ystr_profiles (
    id integer NOT NULL,
    kit_number text NOT NULL,
    name text,
    country text,
    haplogroup text,
    markers jsonb NOT NULL,
    markers_hash character(64) GENERATED ALWAYS AS (encode(sha256(((markers)::text)::bytea), 'hex'::text)) STORED,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: marker_statistics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.marker_statistics AS
 SELECT jsonb_each_text.key AS marker_name,
    count(*) AS total_profiles,
    count(
        CASE
            WHEN ((jsonb_each_text.value <> ''::text) AND (jsonb_each_text.value IS NOT NULL)) THEN 1
            ELSE NULL::integer
        END) AS profiles_with_value,
    array_agg(DISTINCT jsonb_each_text.value ORDER BY jsonb_each_text.value) FILTER (WHERE ((jsonb_each_text.value <> ''::text) AND (jsonb_each_text.value IS NOT NULL))) AS unique_values
   FROM public.ystr_profiles,
    LATERAL jsonb_each_text(ystr_profiles.markers) jsonb_each_text(key, value)
  GROUP BY jsonb_each_text.key
  WITH NO DATA;


--
-- Name: performance_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.performance_stats AS
 SELECT 'total_profiles'::text AS metric,
    (count(*))::text AS value
   FROM public.ystr_profiles
UNION ALL
 SELECT 'unique_haplogroups'::text AS metric,
    (count(DISTINCT ystr_profiles.haplogroup))::text AS value
   FROM public.ystr_profiles
UNION ALL
 SELECT 'avg_markers_per_profile'::text AS metric,
    (avg(( SELECT count(*) AS count
           FROM jsonb_object_keys(ystr_profiles.markers) jsonb_object_keys(jsonb_object_keys))))::text AS value
   FROM public.ystr_profiles;


--
-- Name: profile_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_summary AS
 SELECT ystr_profiles.kit_number,
    ystr_profiles.name,
    ystr_profiles.haplogroup,
    jsonb_object_keys(ystr_profiles.markers) AS available_markers_count,
    ystr_profiles.created_at
   FROM public.ystr_profiles;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    kit_number character varying(50) NOT NULL,
    name character varying(255),
    country character varying(255),
    haplogroup character varying(100),
    markers jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ystr_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ystr_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ystr_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ystr_profiles_id_seq OWNED BY public.ystr_profiles.id;


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: haplogroups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.haplogroups ALTER COLUMN id SET DEFAULT nextval('public.haplogroups_id_seq'::regclass);


--
-- Name: ystr_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ystr_profiles ALTER COLUMN id SET DEFAULT nextval('public.ystr_profiles_id_seq'::regclass);


--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: haplogroups haplogroups_haplogroup_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.haplogroups
    ADD CONSTRAINT haplogroups_haplogroup_key UNIQUE (haplogroup);


--
-- Name: haplogroups haplogroups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.haplogroups
    ADD CONSTRAINT haplogroups_pkey PRIMARY KEY (id);


--
-- Name: marker_order marker_order_marker_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marker_order
    ADD CONSTRAINT marker_order_marker_name_key UNIQUE (marker_name);


--
-- Name: marker_order marker_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marker_order
    ADD CONSTRAINT marker_order_pkey PRIMARY KEY ("position");


--
-- Name: marker_panels marker_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marker_panels
    ADD CONSTRAINT marker_panels_pkey PRIMARY KEY (panel_size);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (kit_number);


--
-- Name: ystr_profiles ystr_profiles_kit_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ystr_profiles
    ADD CONSTRAINT ystr_profiles_kit_number_key UNIQUE (kit_number);


--
-- Name: ystr_profiles ystr_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ystr_profiles
    ADD CONSTRAINT ystr_profiles_pkey PRIMARY KEY (id);


--
-- Name: idx_api_keys_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_active ON public.api_keys USING btree (is_active);


--
-- Name: idx_api_keys_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_expires ON public.api_keys USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_api_keys_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_api_keys_hash ON public.api_keys USING btree (key_hash) WHERE (is_active = true);


--
-- Name: idx_audit_log_api_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_api_key ON public.audit_log USING btree (api_key_id);


--
-- Name: idx_audit_log_api_key_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_api_key_created ON public.audit_log USING btree (api_key_id, created_at DESC);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_operation ON public.audit_log USING btree (operation);


--
-- Name: idx_audit_log_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_record ON public.audit_log USING btree (record_id);


--
-- Name: idx_audit_log_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_table ON public.audit_log USING btree (table_name);


--
-- Name: idx_haplogroups_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_haplogroups_level ON public.haplogroups USING btree (level);


--
-- Name: idx_haplogroups_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_haplogroups_parent ON public.haplogroups USING btree (parent_haplogroup);


--
-- Name: idx_marker_order_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marker_order_name ON public.marker_order USING btree (marker_name);


--
-- Name: idx_marker_order_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marker_order_position ON public.marker_order USING btree ("position");


--
-- Name: idx_marker_stats_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_marker_stats_name ON public.marker_statistics USING btree (marker_name);


--
-- Name: idx_profiles_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_country ON public.profiles USING btree (country);


--
-- Name: idx_profiles_haplogroup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_haplogroup ON public.profiles USING btree (haplogroup);


--
-- Name: idx_profiles_markers; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_markers ON public.profiles USING gin (markers);


--
-- Name: idx_ystr_profiles_haplogroup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ystr_profiles_haplogroup ON public.ystr_profiles USING btree (haplogroup) WHERE (haplogroup IS NOT NULL);


--
-- Name: idx_ystr_profiles_kit_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ystr_profiles_kit_number ON public.ystr_profiles USING btree (kit_number);


--
-- Name: idx_ystr_profiles_markers_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ystr_profiles_markers_gin ON public.ystr_profiles USING gin (markers);


--
-- Name: idx_ystr_profiles_markers_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ystr_profiles_markers_hash ON public.ystr_profiles USING btree (markers_hash);


--
-- Name: ystr_profiles trigger_refresh_marker_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_refresh_marker_stats AFTER INSERT OR DELETE OR UPDATE ON public.ystr_profiles FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_marker_statistics();


--
-- Name: audit_log trigger_update_api_key_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_api_key_usage AFTER INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.update_api_key_usage();


--
-- Name: audit_log audit_log_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id);


--
-- Name: haplogroups haplogroups_parent_haplogroup_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.haplogroups
    ADD CONSTRAINT haplogroups_parent_haplogroup_fkey FOREIGN KEY (parent_haplogroup) REFERENCES public.haplogroups(haplogroup);


--
-- PostgreSQL database dump complete
--

\unrestrict Hdxq15Jko0coxMcM9IWf8PYdczY1YRPyXFOfsabyNvgdcsWg2f9eOatVaqVE7uR


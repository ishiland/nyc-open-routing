-- =============================================================================
-- Traffic Coverage Audit
-- Phase 19: Volume Data Audit
--
-- Analyzes traffic data coverage across two sources:
--   1. Live speed data (TRANSCOM sensors -> edges.traffic_factor)
--   2. Static volume data (NYC DOT traffic counts -> avg_traffic_by_segment)
--
-- Run from api container:
--   docker compose exec api sh -c \
--     'PGPASSWORD=admin psql -h db -U postgres -d routing -f /scripts/audit_traffic_coverage.sql'
-- =============================================================================

\echo '============================================='
\echo 'SECTION 1: Table Existence Check'
\echo '============================================='

SELECT
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'avg_traffic_by_segment') AS has_volume_table,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'traffic_volumes') AS has_volume_raw,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'edge_traffic_stats') AS has_spatial_volume_stats,
    EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'traffic_edge_mapping') AS has_traffic_edge_mapping;

\echo ''
\echo '============================================='
\echo 'SECTION 2: Coverage Analysis'
\echo '============================================='

-- Total driveable edges baseline
\echo ''
\echo '--- Total Driveable Edges ---'
SELECT COUNT(*) AS total_driveable_edges
FROM edges
WHERE driveable = TRUE;

-- Speed data coverage (edges.traffic_factor != 1.0)
\echo ''
\echo '--- Speed Data Coverage (traffic_factor != 1.0) ---'
SELECT
    COUNT(*) AS edges_with_speed_data,
    ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM edges WHERE driveable = TRUE), 0) * 100, 2) AS pct_of_driveable
FROM edges
WHERE driveable = TRUE
  AND traffic_factor IS NOT NULL
  AND traffic_factor != 1.0;

-- Volume data coverage (conditional on table existence)
\echo ''
\echo '--- Volume Data Coverage ---'
DO $$
DECLARE
    vol_table_exists BOOLEAN;
    vol_count BIGINT;
    total_driveable BIGINT;
    distinct_segments BIGINT;
    pct TEXT;
BEGIN
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'avg_traffic_by_segment')
    INTO vol_table_exists;

    SELECT COUNT(*) INTO total_driveable FROM edges WHERE driveable = TRUE;

    IF vol_table_exists THEN
        EXECUTE '
            SELECT COUNT(DISTINCT e.id)
            FROM edges e
            JOIN avg_traffic_by_segment ats ON ats.segment_id = e.segmentid
            WHERE e.driveable = TRUE
        ' INTO vol_count;

        EXECUTE 'SELECT COUNT(DISTINCT segment_id) FROM avg_traffic_by_segment' INTO distinct_segments;

        pct := ROUND(vol_count::numeric / NULLIF(total_driveable, 0) * 100, 2)::text;
        RAISE NOTICE 'Volume table EXISTS: % driveable edges have volume data (% pct of %)',
            vol_count, pct, total_driveable;
        RAISE NOTICE 'Distinct segments in avg_traffic_by_segment: %', distinct_segments;
    ELSE
        RAISE NOTICE 'Volume table avg_traffic_by_segment DOES NOT EXIST. Volume coverage = 0.';
    END IF;
END $$;

-- Combined coverage matrix
\echo ''
\echo '--- Combined Coverage Matrix ---'
DO $$
DECLARE
    vol_table_exists BOOLEAN;
    result_row RECORD;
    total NUMERIC;
BEGIN
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'avg_traffic_by_segment')
    INTO vol_table_exists;

    IF vol_table_exists THEN
        FOR result_row IN
            EXECUTE '
                WITH coverage AS (
                    SELECT
                        e.id,
                        (e.traffic_factor IS NOT NULL AND e.traffic_factor != 1.0) AS has_speed_data,
                        EXISTS (
                            SELECT 1 FROM avg_traffic_by_segment ats
                            WHERE ats.segment_id = e.segmentid
                        ) AS has_volume_data
                    FROM edges e
                    WHERE e.driveable = TRUE
                )
                SELECT
                    COUNT(*) AS total_driveable,
                    SUM(CASE WHEN has_speed_data THEN 1 ELSE 0 END) AS with_speed_data,
                    SUM(CASE WHEN has_volume_data THEN 1 ELSE 0 END) AS with_volume_data,
                    SUM(CASE WHEN has_speed_data AND has_volume_data THEN 1 ELSE 0 END) AS with_both,
                    SUM(CASE WHEN has_speed_data AND NOT has_volume_data THEN 1 ELSE 0 END) AS speed_only,
                    SUM(CASE WHEN NOT has_speed_data AND has_volume_data THEN 1 ELSE 0 END) AS volume_only,
                    SUM(CASE WHEN NOT has_speed_data AND NOT has_volume_data THEN 1 ELSE 0 END) AS neither
                FROM coverage
            '
        LOOP
            total := result_row.total_driveable;
            RAISE NOTICE 'total_driveable:  %', result_row.total_driveable;
            RAISE NOTICE 'with_speed_data:  % (%)',  result_row.with_speed_data, ROUND(result_row.with_speed_data::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
            RAISE NOTICE 'with_volume_data: % (%)', result_row.with_volume_data, ROUND(result_row.with_volume_data::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
            RAISE NOTICE 'with_both:        % (%)', result_row.with_both, ROUND(result_row.with_both::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
            RAISE NOTICE 'speed_only:       % (%)', result_row.speed_only, ROUND(result_row.speed_only::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
            RAISE NOTICE 'volume_only:      % (%)', result_row.volume_only, ROUND(result_row.volume_only::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
            RAISE NOTICE 'neither:          % (%)', result_row.neither, ROUND(result_row.neither::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
        END LOOP;
    ELSE
        -- No volume table: all coverage analysis is speed-only
        FOR result_row IN
            SELECT
                COUNT(*) AS total_driveable,
                SUM(CASE WHEN e.traffic_factor IS NOT NULL AND e.traffic_factor != 1.0 THEN 1 ELSE 0 END) AS with_speed_data,
                0::bigint AS with_volume_data,
                0::bigint AS with_both,
                SUM(CASE WHEN e.traffic_factor IS NOT NULL AND e.traffic_factor != 1.0 THEN 1 ELSE 0 END) AS speed_only,
                0::bigint AS volume_only,
                SUM(CASE WHEN e.traffic_factor IS NULL OR e.traffic_factor = 1.0 THEN 1 ELSE 0 END) AS neither
            FROM edges e
            WHERE e.driveable = TRUE
        LOOP
            total := result_row.total_driveable;
            RAISE NOTICE 'total_driveable:  %', result_row.total_driveable;
            RAISE NOTICE 'with_speed_data:  % (%)', result_row.with_speed_data, ROUND(result_row.with_speed_data::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
            RAISE NOTICE 'with_volume_data: 0 (N/A - table does not exist)';
            RAISE NOTICE 'with_both:        0 (N/A)';
            RAISE NOTICE 'speed_only:       % (%)', result_row.speed_only, ROUND(result_row.speed_only::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
            RAISE NOTICE 'volume_only:      0 (N/A)';
            RAISE NOTICE 'neither:          % (%)', result_row.neither, ROUND(result_row.neither::numeric / NULLIF(total, 0) * 100, 2)::text || ' pct';
        END LOOP;
    END IF;
END $$;

\echo ''
\echo '============================================='
\echo 'SECTION 3: Distribution Analysis'
\echo '============================================='

-- Speed data distribution (traffic_factor buckets)
\echo ''
\echo '--- Speed Data Distribution (traffic_factor buckets) ---'
SELECT
    CASE
        WHEN traffic_factor > 1.0 AND traffic_factor <= 1.2 THEN '1.01-1.20 (light congestion)'
        WHEN traffic_factor > 1.2 AND traffic_factor <= 1.5 THEN '1.21-1.50 (moderate)'
        WHEN traffic_factor > 1.5 AND traffic_factor <= 2.0 THEN '1.51-2.00 (heavy)'
        WHEN traffic_factor > 2.0 AND traffic_factor <= 3.0 THEN '2.01-3.00 (severe)'
        ELSE 'other'
    END AS factor_bucket,
    COUNT(*) AS edge_count,
    ROUND(AVG(traffic_factor), 3) AS avg_factor,
    ROUND(MIN(traffic_factor), 3) AS min_factor,
    ROUND(MAX(traffic_factor), 3) AS max_factor
FROM edges
WHERE driveable = TRUE
  AND traffic_factor IS NOT NULL
  AND traffic_factor != 1.0
GROUP BY
    CASE
        WHEN traffic_factor > 1.0 AND traffic_factor <= 1.2 THEN '1.01-1.20 (light congestion)'
        WHEN traffic_factor > 1.2 AND traffic_factor <= 1.5 THEN '1.21-1.50 (moderate)'
        WHEN traffic_factor > 1.5 AND traffic_factor <= 2.0 THEN '1.51-2.00 (heavy)'
        WHEN traffic_factor > 2.0 AND traffic_factor <= 3.0 THEN '2.01-3.00 (severe)'
        ELSE 'other'
    END
ORDER BY min_factor;

-- Volume data distinct segments (if table exists)
\echo ''
\echo '--- Volume Data Segment Count ---'
DO $$
DECLARE
    vol_table_exists BOOLEAN;
    seg_count BIGINT;
    row_count BIGINT;
BEGIN
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'avg_traffic_by_segment')
    INTO vol_table_exists;

    IF vol_table_exists THEN
        EXECUTE 'SELECT COUNT(DISTINCT segment_id), COUNT(*) FROM avg_traffic_by_segment'
        INTO seg_count, row_count;
        RAISE NOTICE 'Distinct segments: %, total rows (segment x hour x day): %', seg_count, row_count;
    ELSE
        RAISE NOTICE 'avg_traffic_by_segment table does not exist. Volume data not imported.';
    END IF;
END $$;

\echo ''
\echo '============================================='
\echo 'SECTION 4: Conflict Analysis'
\echo '============================================='

-- Edges with volume data that have traffic_factor = 1.0
-- (meaning live speed service has reset their factors)
\echo ''
\echo '--- Conflict: Edges with volume data but traffic_factor = 1.0 ---'
DO $$
DECLARE
    vol_table_exists BOOLEAN;
    conflict_count BIGINT;
    vol_total BIGINT;
    pct TEXT;
BEGIN
    SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'avg_traffic_by_segment')
    INTO vol_table_exists;

    IF vol_table_exists THEN
        EXECUTE '
            SELECT
                COUNT(*) FILTER (WHERE e.traffic_factor = 1.0 OR e.traffic_factor IS NULL) AS conflict_count,
                COUNT(*) AS total_with_volume
            FROM edges e
            JOIN (SELECT DISTINCT segment_id FROM avg_traffic_by_segment) ats
                ON ats.segment_id = e.segmentid
            WHERE e.driveable = TRUE
        ' INTO conflict_count, vol_total;

        pct := ROUND(conflict_count::numeric / NULLIF(vol_total, 0) * 100, 2)::text;
        RAISE NOTICE 'Edges with volume data AND traffic_factor=1.0: % out of % (% pct)',
            conflict_count, vol_total, pct;
        RAISE NOTICE 'This means the live speed service has overwritten % of volume-derived factors to 1.0',
            conflict_count;
    ELSE
        RAISE NOTICE 'No volume table exists. No conflict possible.';
    END IF;
END $$;

-- Summary of current traffic_factor column state
\echo ''
\echo '--- Current traffic_factor Column Summary ---'
SELECT
    COUNT(*) AS total_driveable,
    SUM(CASE WHEN traffic_factor IS NULL THEN 1 ELSE 0 END) AS null_factor,
    SUM(CASE WHEN traffic_factor = 1.0 THEN 1 ELSE 0 END) AS factor_1_0,
    SUM(CASE WHEN traffic_factor > 1.0 THEN 1 ELSE 0 END) AS factor_above_1,
    ROUND(AVG(traffic_factor), 4) AS avg_factor,
    ROUND(MAX(traffic_factor), 4) AS max_factor
FROM edges
WHERE driveable = TRUE;

\echo ''
\echo '============================================='
\echo 'AUDIT COMPLETE'
\echo '============================================='

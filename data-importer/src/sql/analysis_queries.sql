-- Routing Query Performance Analysis
-- Use these queries to profile and analyze routing performance

-- ====================================
-- 1. EDGE STATISTICS
-- ====================================

-- Total edges by mode
SELECT
    COUNT(*) as total_edges,
    COUNT(*) FILTER (WHERE driveable = TRUE) as driveable_edges,
    COUNT(*) FILTER (WHERE bikeable = TRUE) as bikeable_edges,
    COUNT(*) FILTER (WHERE walkable = TRUE) as walkable_edges
FROM edges;

-- Edge distribution by feature type
SELECT
    featuretyp,
    COUNT(*) as count,
    ROUND(AVG(length_feet)::numeric, 2) as avg_length_feet,
    ROUND(AVG(time_drive)::numeric, 4) as avg_time_drive_min,
    ROUND(AVG(cost_drive)::numeric, 4) as avg_cost_drive
FROM edges
WHERE driveable = TRUE
GROUP BY featuretyp
ORDER BY count DESC;

-- ====================================
-- 2. NETWORK TOPOLOGY ANALYSIS
-- ====================================

-- Check for disconnected graph components (nodes with no edges)
SELECT
    COUNT(*) as isolated_nodes
FROM edges_vertices_pgr v
WHERE NOT EXISTS (
    SELECT 1 FROM edges e
    WHERE e.source = v.id OR e.target = v.id
);

-- Degree distribution (how many edges connect to each node)
SELECT
    degree,
    COUNT(*) as node_count
FROM (
    SELECT
        v.id,
        COUNT(DISTINCT e.id) as degree
    FROM edges_vertices_pgr v
    LEFT JOIN edges e ON (e.source = v.id OR e.target = v.id)
    GROUP BY v.id
) subq
GROUP BY degree
ORDER BY degree;

-- Dead-end streets (nodes with only 1 connection)
SELECT COUNT(*) as dead_end_count
FROM (
    SELECT
        v.id,
        COUNT(DISTINCT e.id) as degree
    FROM edges_vertices_pgr v
    LEFT JOIN edges e ON (e.source = v.id OR e.target = v.id)
    GROUP BY v.id
    HAVING COUNT(DISTINCT e.id) = 1
) dead_ends;

-- ====================================
-- 3. COST DISTRIBUTION ANALYSIS
-- ====================================

-- Driving cost percentiles
SELECT
    ROUND(percentile_cont(0.25) WITHIN GROUP (ORDER BY cost_drive)::numeric, 4) as p25_cost,
    ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY cost_drive)::numeric, 4) as median_cost,
    ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY cost_drive)::numeric, 4) as p75_cost,
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY cost_drive)::numeric, 4) as p95_cost,
    ROUND(MAX(cost_drive)::numeric, 4) as max_cost
FROM edges
WHERE driveable = TRUE;

-- Biking cost analysis (checking for unrealistic penalties)
SELECT
    'No bike lane penalty' as category,
    COUNT(*) as edge_count,
    ROUND(AVG(cost_bike / time_bike)::numeric, 2) as avg_penalty_multiplier
FROM edges
WHERE bikeable = TRUE
    AND (bikelane IS NULL OR TRIM(bikelane) = '')
UNION ALL
SELECT
    'Has bike lane' as category,
    COUNT(*) as edge_count,
    ROUND(AVG(cost_bike / time_bike)::numeric, 2) as avg_penalty_multiplier
FROM edges
WHERE bikeable = TRUE
    AND bikelane IS NOT NULL
    AND TRIM(bikelane) != ''
    AND TRIM(bikelane) != '7';

-- ====================================
-- 4. TURN RESTRICTIONS
-- ====================================

-- Turn restriction statistics
SELECT
    COUNT(*) as total_restrictions,
    COUNT(DISTINCT from_edge) as unique_from_edges,
    COUNT(DISTINCT to_edge) as unique_to_edges,
    COUNT(DISTINCT via_node) as unique_via_nodes
FROM restrictions;

-- Restrictions by level mismatch
SELECT
    e_from.level_to as from_level,
    e_to.level_from as to_level,
    COUNT(*) as restriction_count
FROM restrictions r
JOIN edges e_from ON r.from_edge = e_from.id
JOIN edges e_to ON r.to_edge = e_to.id
WHERE e_from.level_to != e_to.level_from
GROUP BY e_from.level_to, e_to.level_from
ORDER BY restriction_count DESC
LIMIT 10;

-- ====================================
-- 5. QUERY PERFORMANCE PROFILING
-- ====================================

-- Example: Profile a driving route query
-- Replace coordinates with actual NYC locations for testing
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM getdrivingroute_with_traffic(
    40.7589, -73.9851,  -- Times Square
    40.7484, -73.9857,  -- Empire State Building
    12, 2  -- Noon on Tuesday
);

-- Check index usage on edges table
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'edges'
ORDER BY idx_scan DESC;

-- Table statistics
SELECT
    schemaname,
    tablename,
    n_live_tup as row_count,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('edges', 'edges_vertices_pgr', 'restrictions')
ORDER BY n_live_tup DESC;

-- ====================================
-- 6. DATA QUALITY CHECKS
-- ====================================

-- Edges with invalid costs (negative, zero, or extremely high)
SELECT
    'Driving' as mode,
    COUNT(*) FILTER (WHERE cost_drive <= 0) as zero_or_negative,
    COUNT(*) FILTER (WHERE cost_drive > 1000) as extremely_high
FROM edges
WHERE driveable = TRUE
UNION ALL
SELECT
    'Biking' as mode,
    COUNT(*) FILTER (WHERE cost_bike <= 0) as zero_or_negative,
    COUNT(*) FILTER (WHERE cost_bike > 1000) as extremely_high
FROM edges
WHERE bikeable = TRUE
UNION ALL
SELECT
    'Walking' as mode,
    COUNT(*) FILTER (WHERE cost_walk <= 0) as zero_or_negative,
    COUNT(*) FILTER (WHERE cost_walk > 1000) as extremely_high
FROM edges
WHERE walkable = TRUE;

-- Edges with NULL geometry
SELECT COUNT(*) as edges_with_null_geom
FROM edges
WHERE the_geom IS NULL;

-- Speed limit distribution
SELECT
    posted_speed,
    COUNT(*) as edge_count,
    ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ())::numeric, 2) as percentage
FROM edges
WHERE driveable = TRUE
GROUP BY posted_speed
ORDER BY posted_speed;

-- One-way street distribution
SELECT
    one_way,
    CASE
        WHEN one_way = 'B' THEN 'Both directions'
        WHEN one_way = 'FT' THEN 'One-way: from->to'
        WHEN one_way = 'TF' THEN 'One-way: to->from'
        ELSE 'Unknown'
    END as direction_description,
    COUNT(*) as edge_count
FROM edges
WHERE driveable = TRUE
GROUP BY one_way
ORDER BY edge_count DESC;

-- ====================================
-- 7. SAMPLE ROUTE TESTING
-- ====================================

-- Test route: Manhattan to Brooklyn over Manhattan Bridge
-- Origin: City Hall Park (40.7128, -74.0060)
-- Dest: Brooklyn Heights (40.6946, -73.9902)
SELECT
    seq,
    street,
    ROUND(distance::numeric, 2) as distance_feet,
    ROUND(travel_time::numeric, 4) as time_minutes,
    turn_instruction
FROM getdrivingroute(40.7128, -74.0060, 40.6946, -73.9902)
ORDER BY seq;

-- Compare route times across modes for same origin/destination
WITH test_coords AS (
    SELECT
        40.7589 as orig_lat, -73.9851 as orig_lon,  -- Times Square
        40.7484 as dest_lat, -73.9857 as dest_lon   -- Empire State
)
SELECT
    'Driving' as mode,
    COUNT(*) as segment_count,
    ROUND(SUM(distance)::numeric, 2) as total_distance_feet,
    ROUND(SUM(travel_time)::numeric, 4) as total_time_minutes
FROM test_coords,
    LATERAL getdrivingroute(orig_lat, orig_lon, dest_lat, dest_lon)
UNION ALL
SELECT
    'Biking' as mode,
    COUNT(*) as segment_count,
    ROUND(SUM(distance)::numeric, 2) as total_distance_feet,
    ROUND(SUM(travel_time)::numeric, 4) as total_time_minutes
FROM test_coords,
    LATERAL getbikingroute(orig_lat, orig_lon, dest_lat, dest_lon)
UNION ALL
SELECT
    'Walking' as mode,
    COUNT(*) as segment_count,
    ROUND(SUM(distance)::numeric, 2) as total_distance_feet,
    ROUND(SUM(travel_time)::numeric, 4) as total_time_minutes
FROM test_coords,
    LATERAL getwalkingroute(orig_lat, orig_lon, dest_lat, dest_lon);

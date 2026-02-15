-- ============================================================================
-- 09_ferry_connections.sql
--
-- Ferry Topology Isolation + Staten Island Ferry Terminal Connections
--
-- Purpose: Two-part ferry network fix:
--   Part A: Isolate ferry route internal nodes from bridge/tunnel topology
--           to prevent invalid route transitions between ferry and bridge
--           edges that share 2D coordinates but exist at different elevations.
--   Part B: Create manual SI Ferry terminal connections between Staten Island
--           and Manhattan for bike/walk routing.
--
-- Background: LION ferry segments share 2D endpoint coordinates with
--             bridge/tunnel segments despite being at different elevations
--             (water level vs. elevated). pgr_extractVertices assigns them
--             the same vertex IDs, allowing the router to jump between
--             ferry and bridge/tunnel edges mid-crossing.
--
-- Solution:
--   Part A: Create new vertex IDs for ferry internal nodes (nodes shared
--           with bridge/tunnel but not with regular streets), update ferry
--           edges to use the new vertices, preserving terminal connectivity.
--   Part B: Create manual "ferry terminal access" edges connecting:
--           1. St. George Terminal (Staten Island) -> nearest street node
--           2. Whitehall Terminal (Manhattan) -> nearest street node
--
-- Real-World Validation: The Staten Island Ferry allows bicycles as walk-on
--                        passengers, making bike/walk routing via ferry valid.
--
-- Related: See Part B comments below for SI ferry workaround details
-- ============================================================================

-- Record the max vertex ID before any changes (used at end for accessibility update)
CREATE TEMP TABLE original_max_vertex_id AS
SELECT COALESCE(MAX(id), 0) AS max_id FROM edges_vertices_pgr;

-- ============================================================================
-- Part A: Isolate Ferry Internal Nodes from Bridge/Tunnel Topology
-- ============================================================================
-- Ferry edges sharing internal nodes with bridge/tunnel edges allows invalid
-- route transitions. This step creates new vertex IDs for ferry internal nodes
-- while preserving terminal connections to the street network.
-- ============================================================================

-- Step 0: Identify and isolate ferry internal nodes
-- A ferry node is "internal" if:
--   1. It connects to at least one ferry edge (featuretyp = 'F')
--   2. It does NOT connect to any regular street edge (non-ferry, non-bridge, non-tunnel)
--   3. It DOES connect to at least one bridge (rw_type='3') or tunnel (rw_type='4') edge
-- A ferry node is "terminal" if it connects to at least one regular street edge
-- (these stay shared so passengers can board/exit the ferry).

CREATE TEMP TABLE ferry_node_mapping AS
WITH ferry_nodes AS (
    -- All nodes that are source or target of a ferry edge
    SELECT DISTINCT node_id FROM (
        SELECT source AS node_id FROM edges WHERE featuretyp = 'F'
        UNION
        SELECT target AS node_id FROM edges WHERE featuretyp = 'F'
    ) sub
),
node_classification AS (
    -- Classify each ferry node: does it connect to a regular street?
    -- TRIM(rw_type) needed because rw_type has leading spaces in LION data
    SELECT fn.node_id,
        bool_or(e.featuretyp != 'F' AND TRIM(e.rw_type) NOT IN ('3', '4')) AS has_street_connection
    FROM ferry_nodes fn
    JOIN edges e ON (e.source = fn.node_id OR e.target = fn.node_id)
    GROUP BY fn.node_id
),
shared_internal_nodes AS (
    -- Internal nodes that are shared with bridge/tunnel edges
    -- (ferry-only nodes are already isolated and don't need new IDs)
    SELECT nc.node_id FROM node_classification nc
    WHERE nc.has_street_connection = FALSE
    AND EXISTS (
        SELECT 1 FROM edges e
        WHERE (e.source = nc.node_id OR e.target = nc.node_id)
        AND TRIM(e.rw_type) IN ('3', '4')
    )
)
-- Create mapping from old node IDs to new unique IDs
SELECT
    node_id AS old_id,
    (SELECT COALESCE(MAX(id), 0) FROM edges_vertices_pgr) + ROW_NUMBER() OVER (ORDER BY node_id) AS new_id
FROM shared_internal_nodes;

-- Insert new vertices at the same geometry as the old nodes
INSERT INTO edges_vertices_pgr (id, geom, x, y)
SELECT m.new_id, v.geom, v.x, v.y
FROM ferry_node_mapping m
JOIN edges_vertices_pgr v ON v.id = m.old_id;

-- Update ferry edges to point to new isolated vertices (source)
UPDATE edges e SET source = m.new_id
FROM ferry_node_mapping m
WHERE e.featuretyp = 'F' AND e.source = m.old_id;

-- Update ferry edges to point to new isolated vertices (target)
UPDATE edges e SET target = m.new_id
FROM ferry_node_mapping m
WHERE e.featuretyp = 'F' AND e.target = m.old_id;

-- Report isolation results
DO $$
DECLARE
    isolated_count INTEGER;
    updated_source INTEGER;
    updated_target INTEGER;
    terminal_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO isolated_count FROM ferry_node_mapping;

    SELECT COUNT(*) INTO updated_source
    FROM edges e
    JOIN ferry_node_mapping m ON e.source = m.new_id
    WHERE e.featuretyp = 'F';

    SELECT COUNT(*) INTO updated_target
    FROM edges e
    JOIN ferry_node_mapping m ON e.target = m.new_id
    WHERE e.featuretyp = 'F';

    -- Count terminal nodes (ferry nodes that connect to regular streets)
    WITH ferry_nodes AS (
        SELECT DISTINCT node_id FROM (
            SELECT source AS node_id FROM edges WHERE featuretyp = 'F'
            UNION
            SELECT target AS node_id FROM edges WHERE featuretyp = 'F'
        ) sub
    ),
    node_classification AS (
        SELECT fn.node_id,
            bool_or(e.featuretyp != 'F' AND TRIM(e.rw_type) NOT IN ('3', '4')) AS has_street_connection
        FROM ferry_nodes fn
        JOIN edges e ON (e.source = fn.node_id OR e.target = fn.node_id)
        GROUP BY fn.node_id
    )
    SELECT COUNT(*) INTO terminal_count
    FROM node_classification
    WHERE has_street_connection = TRUE;

    RAISE NOTICE 'Ferry topology isolation: % internal nodes isolated, % ferry edges updated (% source + % target), % terminal nodes preserved',
        isolated_count, updated_source + updated_target, updated_source, updated_target, terminal_count;
END $$;

-- Drop isolation temp table
DROP TABLE IF EXISTS ferry_node_mapping;

-- ============================================================================
-- Part B: Staten Island Ferry Terminal Connections
-- ============================================================================
-- LION contains a route labeled "STATEN ISLAND FERRY ROUTE" but it
-- connects Brooklyn (Red Hook) to Manhattan, not Staten Island to Manhattan.
-- No ferry routes in LION reach Staten Island, leaving it isolated for
-- bike/walk modes. This section creates manual connections.
-- ============================================================================

-- ============================================================================
-- Step 1: Create Terminal Access Nodes
-- ============================================================================

-- Create St. George Terminal node (Staten Island)
-- Real-world location: 40.6434 N, 74.0743 W
INSERT INTO edges_vertices_pgr (id, geom)
SELECT
    COALESCE((SELECT MAX(id) FROM edges_vertices_pgr), 0) + 1,
    ST_Transform(ST_SetSRID(ST_MakePoint(-74.0743, 40.6434), 4326), 2263)
WHERE NOT EXISTS (
    SELECT 1 FROM edges_vertices_pgr
    WHERE ST_DWithin(
        geom,
        ST_Transform(ST_SetSRID(ST_MakePoint(-74.0743, 40.6434), 4326), 2263),
        10  -- 10 feet tolerance
    )
);

-- Create Whitehall Terminal node (Manhattan)
-- Real-world location: 40.7024 N, 74.0134 W
INSERT INTO edges_vertices_pgr (id, geom)
SELECT
    COALESCE((SELECT MAX(id) FROM edges_vertices_pgr), 0) + 1,
    ST_Transform(ST_SetSRID(ST_MakePoint(-74.0134, 40.7024), 4326), 2263)
WHERE NOT EXISTS (
    SELECT 1 FROM edges_vertices_pgr
    WHERE ST_DWithin(
        geom,
        ST_Transform(ST_SetSRID(ST_MakePoint(-74.0134, 40.7024), 4326), 2263),
        10  -- 10 feet tolerance
    )
);

-- ============================================================================
-- Step 2: Get Node IDs
-- ============================================================================

-- Store node IDs for connection creation
CREATE TEMP TABLE ferry_nodes AS
WITH st_george_terminal AS (
    SELECT id FROM edges_vertices_pgr
    WHERE ST_DWithin(
        geom,
        ST_Transform(ST_SetSRID(ST_MakePoint(-74.0743, 40.6434), 4326), 2263),
        10
    )
    LIMIT 1
),
whitehall_terminal AS (
    SELECT id FROM edges_vertices_pgr
    WHERE ST_DWithin(
        geom,
        ST_Transform(ST_SetSRID(ST_MakePoint(-74.0134, 40.7024), 4326), 2263),
        10
    )
    LIMIT 1
)
SELECT
    13013 as staten_island_street_node,  -- Ferry Terminal Viaduct (Staten Island)
    (SELECT id FROM st_george_terminal) as st_george_node,
    16862 as manhattan_street_node,       -- Peter Minuit Plaza Greenway (Manhattan)
    (SELECT id FROM whitehall_terminal) as whitehall_node;

-- ============================================================================
-- Step 3: Create Ferry Terminal Access Edges
-- ============================================================================

-- Get next edge ID
CREATE TEMP TABLE next_edge_id AS
SELECT COALESCE(MAX(id), 0) + 1 as id FROM edges;

-- St. George Terminal -> Staten Island street (bidirectional)
-- Distance: ~117 feet
INSERT INTO edges (
    id, source, target, street, featuretyp, rw_type,
    driveable, bikeable, walkable,
    the_geom, geom_4326,
    cost_drive, cost_bike, cost_walk,
    rcost_drive, rcost_bike, rcost_walk,
    time_drive, time_bike, time_walk,
    traffic_factor
)
SELECT
    (SELECT id FROM next_edge_id),
    fn.staten_island_street_node,
    fn.st_george_node,
    'ST GEORGE FERRY TERMINAL ACCESS',
    '0',  -- Street
    '1',  -- Street type
    FALSE,  -- Not driveable (pedestrian/bike only)
    TRUE,   -- Bikeable (ferry allows bikes)
    TRUE,   -- Walkable
    -- Create geometry line between nodes
    ST_MakeLine(
        (SELECT geom FROM edges_vertices_pgr WHERE id = fn.staten_island_street_node),
        (SELECT geom FROM edges_vertices_pgr WHERE id = fn.st_george_node)
    ),
    ST_Transform(
        ST_MakeLine(
            (SELECT geom FROM edges_vertices_pgr WHERE id = fn.staten_island_street_node),
            (SELECT geom FROM edges_vertices_pgr WHERE id = fn.st_george_node)
        ),
        4326
    ),
    999999,  -- Not driveable (high cost)
    0.02,    -- ~117 feet / 5280 ft/mile = 0.022 miles (minimal bike cost)
    0.02,    -- Same for walking
    999999,  -- Reverse: not driveable
    0.02,    -- Reverse: bikeable
    0.02,    -- Reverse: walkable
    999,     -- Not driveable (high time)
    0.11,    -- 0.022 mi / 12 mph * 60 = 0.11 minutes
    0.44,    -- 0.022 mi / 3 mph * 60 = 0.44 minutes
    1.0      -- No traffic factor (pedestrian access)
FROM ferry_nodes fn;

-- Update next edge ID
UPDATE next_edge_id SET id = id + 1;

-- Whitehall Terminal -> Manhattan street (bidirectional)
-- Distance: ~55 feet
INSERT INTO edges (
    id, source, target, street, featuretyp, rw_type,
    driveable, bikeable, walkable,
    the_geom, geom_4326,
    cost_drive, cost_bike, cost_walk,
    rcost_drive, rcost_bike, rcost_walk,
    time_drive, time_bike, time_walk,
    traffic_factor
)
SELECT
    (SELECT id FROM next_edge_id),
    fn.manhattan_street_node,
    fn.whitehall_node,
    'WHITEHALL FERRY TERMINAL ACCESS',
    '0',  -- Street
    '1',  -- Street type
    FALSE,  -- Not driveable
    TRUE,   -- Bikeable
    TRUE,   -- Walkable
    ST_MakeLine(
        (SELECT geom FROM edges_vertices_pgr WHERE id = fn.manhattan_street_node),
        (SELECT geom FROM edges_vertices_pgr WHERE id = fn.whitehall_node)
    ),
    ST_Transform(
        ST_MakeLine(
            (SELECT geom FROM edges_vertices_pgr WHERE id = fn.manhattan_street_node),
            (SELECT geom FROM edges_vertices_pgr WHERE id = fn.whitehall_node)
        ),
        4326
    ),
    999999,
    0.01,    -- ~55 feet / 5280 = 0.010 miles
    0.01,
    999999,
    0.01,
    0.01,
    999,
    0.05,    -- 0.010 mi / 12 mph * 60 = 0.05 minutes
    0.20,    -- 0.010 mi / 3 mph * 60 = 0.20 minutes
    1.0
FROM ferry_nodes fn;

-- ============================================================================
-- Step 4: Create Ferry Crossing Edge
-- ============================================================================

-- Update next edge ID
UPDATE next_edge_id SET id = id + 1;

-- Ferry crossing: St. George Terminal <-> Whitehall Terminal
-- Distance: ~5.2 miles (water crossing)
-- Ferry travel time: ~25 minutes
-- Waiting time penalty: ~15 minutes (average wait for ferry)
INSERT INTO edges (
    id, source, target, street, featuretyp, rw_type,
    driveable, bikeable, walkable,
    the_geom, geom_4326,
    cost_drive, cost_bike, cost_walk,
    rcost_drive, rcost_bike, rcost_walk,
    time_drive, time_bike, time_walk,
    traffic_factor
)
SELECT
    (SELECT id FROM next_edge_id),
    fn.st_george_node,
    fn.whitehall_node,
    'STATEN ISLAND FERRY',
    'F',  -- Ferry
    '14', -- Ferry RW type
    FALSE,  -- Not driveable (this is for bikes/pedestrians)
    TRUE,   -- Bikeable (bikes allowed on ferry)
    TRUE,   -- Walkable
    ST_MakeLine(
        (SELECT geom FROM edges_vertices_pgr WHERE id = fn.st_george_node),
        (SELECT geom FROM edges_vertices_pgr WHERE id = fn.whitehall_node)
    ),
    ST_Transform(
        ST_MakeLine(
            (SELECT geom FROM edges_vertices_pgr WHERE id = fn.st_george_node),
            (SELECT geom FROM edges_vertices_pgr WHERE id = fn.whitehall_node)
        ),
        4326
    ),
    999999,  -- Not driveable
    -- Bike cost: Distance equivalent that feels like 40 minutes (25min ferry + 15min wait)
    -- 40 min / 60 * 12 mph = 8 miles (feels like biking 8 miles due to time penalty)
    8.0,
    -- Walk cost: Same time, slower speed
    -- 40 min / 60 * 3 mph = 2 miles
    2.0,
    999999,  -- Reverse: not driveable
    8.0,     -- Reverse: same cost
    2.0,     -- Reverse: same cost
    999,     -- Not driveable
    40.0,    -- 25 min ferry + 15 min wait
    40.0,    -- Same for walking (on the ferry)
    1.0      -- No traffic factor
FROM ferry_nodes fn;

-- ============================================================================
-- Step 5: Update Vertex Accessibility Flags
-- ============================================================================

-- Update accessibility flags for ALL new vertices created in this file
-- (both isolation vertices from Part A and SI Ferry terminal vertices from Part B)
UPDATE edges_vertices_pgr v
SET
    has_bikeable = EXISTS (
        SELECT 1 FROM edges e
        WHERE (e.source = v.id OR e.target = v.id) AND e.bikeable = TRUE
    ),
    has_walkable = EXISTS (
        SELECT 1 FROM edges e
        WHERE (e.source = v.id OR e.target = v.id) AND e.walkable = TRUE
    ),
    has_driveable = EXISTS (
        SELECT 1 FROM edges e
        WHERE (e.source = v.id OR e.target = v.id) AND e.driveable = TRUE
    )
WHERE v.id > (SELECT max_id FROM original_max_vertex_id);

-- ============================================================================
-- Step 6: Verify Connections
-- ============================================================================

-- Check connectivity between Staten Island and Manhattan
WITH component_check AS (
    SELECT
        COUNT(DISTINCT component) as num_components,
        MAX(nodes) as largest_component_size
    FROM (
        SELECT component, COUNT(*) as nodes
        FROM pgr_connectedComponents('SELECT id, source, target, cost_bike AS cost FROM edges WHERE bikeable=TRUE')
        GROUP BY component
    ) sub
)
SELECT
    num_components,
    largest_component_size,
    CASE
        WHEN num_components = 1 THEN 'SUCCESS: Single connected network'
        WHEN largest_component_size > 95000 THEN 'LIKELY SUCCESS: Large component includes both boroughs'
        ELSE 'WARNING: Multiple components still exist'
    END as status
FROM component_check;

-- Report final statistics
DO $$
DECLARE
    ferry_edge_count INTEGER;
    terminal_count INTEGER;
    isolation_vertex_count INTEGER;
BEGIN
    -- Count ferry edges created
    SELECT COUNT(*) INTO ferry_edge_count
    FROM edges
    WHERE street LIKE '%FERRY%';

    -- Count terminal nodes
    SELECT COUNT(*) INTO terminal_count
    FROM edges_vertices_pgr
    WHERE ST_DWithin(geom, ST_Transform(ST_SetSRID(ST_MakePoint(-74.0743, 40.6434), 4326), 2263), 10)
       OR ST_DWithin(geom, ST_Transform(ST_SetSRID(ST_MakePoint(-74.0134, 40.7024), 4326), 2263), 10);

    -- Count isolation vertices created
    SELECT COUNT(*) INTO isolation_vertex_count
    FROM edges_vertices_pgr
    WHERE id > (SELECT max_id FROM original_max_vertex_id)
      AND id NOT IN (
          SELECT st_george_node FROM ferry_nodes
          UNION SELECT whitehall_node FROM ferry_nodes
      );

    RAISE NOTICE 'Staten Island Ferry: % total ferry edges, % SI terminal nodes created', ferry_edge_count, terminal_count;
    RAISE NOTICE 'Ferry topology isolation: % isolation vertices created', isolation_vertex_count;
    RAISE NOTICE 'Note: SI ferry workaround for missing LION data (40 min crossing: 25 min travel + 15 min wait)';
END $$;

-- Clean up temp tables
DROP TABLE IF EXISTS ferry_nodes;
DROP TABLE IF EXISTS next_edge_id;
DROP TABLE IF EXISTS original_max_vertex_id;

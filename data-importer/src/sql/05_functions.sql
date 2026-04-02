-- Mode-specific nearest node functions
-- These ensure coordinates snap to nodes accessible by the requested travel mode
-- This prevents routing failures when coordinates are near mode-inaccessible edges
-- (e.g., driveways for driving routes, highways for walking routes)
--
-- PERFORMANCE NOTE: The KNN operator (<->) requires a GiST index on edges_vertices_pgr.geom
-- This index is created in 06_performance_indexes.sql. Without it, these functions
-- perform full table scans on every routing request (240k+ vertices).

-- Drop legacy generic function
DROP FUNCTION IF EXISTS getnearestnode(double precision, double precision);

-- Get nearest node with at least one driveable edge
-- PHASE 2 OPTIMIZATION: Uses pre-computed has_driveable flag (see 07_vertex_accessibility.sql)
-- This eliminates expensive EXISTS subquery and enables partial GiST index
DROP FUNCTION IF EXISTS getnearestdrivenode(double precision, double precision);
CREATE OR REPLACE FUNCTION getnearestdrivenode(_lon FLOAT, _lat FLOAT)
  RETURNS INT AS
$func$
BEGIN
  RETURN
  (SELECT v.id
   FROM edges_vertices_pgr AS v
   WHERE v.has_driveable = TRUE  -- Simple filter using pre-computed flag
   ORDER BY v.geom <-> ST_Transform(ST_SetSRID(ST_MakePoint(_lon, _lat), 4326), 2263)
   LIMIT 1);
END
$func$ LANGUAGE plpgsql STABLE;  -- STABLE (not IMMUTABLE): allows cache within transaction, respects data updates

-- Get nearest node with at least one bikeable edge
-- PHASE 2 OPTIMIZATION: Uses pre-computed has_bikeable flag (see 07_vertex_accessibility.sql)
-- This eliminates expensive EXISTS subquery and enables partial GiST index
DROP FUNCTION IF EXISTS getnearestbikenode(double precision, double precision);
CREATE OR REPLACE FUNCTION getnearestbikenode(_lon FLOAT, _lat FLOAT)
  RETURNS INT AS
$func$
BEGIN
  RETURN
  (SELECT v.id
   FROM edges_vertices_pgr AS v
   WHERE v.has_bikeable = TRUE  -- Simple filter using pre-computed flag
   ORDER BY v.geom <-> ST_Transform(ST_SetSRID(ST_MakePoint(_lon, _lat), 4326), 2263)
   LIMIT 1);
END
$func$ LANGUAGE plpgsql STABLE;  -- STABLE (not IMMUTABLE): allows cache within transaction, respects data updates

-- Get nearest node with at least one walkable edge
-- PHASE 2 OPTIMIZATION: Uses pre-computed has_walkable flag (see 07_vertex_accessibility.sql)
-- This eliminates expensive EXISTS subquery and enables partial GiST index
DROP FUNCTION IF EXISTS getnearestwalknode(double precision, double precision);
CREATE OR REPLACE FUNCTION getnearestwalknode(_lon FLOAT, _lat FLOAT)
  RETURNS INT AS
$func$
BEGIN
  RETURN
  (SELECT v.id
   FROM edges_vertices_pgr AS v
   WHERE v.has_walkable = TRUE  -- Simple filter using pre-computed flag
   ORDER BY v.geom <-> ST_Transform(ST_SetSRID(ST_MakePoint(_lon, _lat), 4326), 2263)
   LIMIT 1);
END
$func$ LANGUAGE plpgsql STABLE;  -- STABLE (not IMMUTABLE): allows cache within transaction, respects data updates

-- Helper function to determine turn direction based on angle
-- Uses industry-standard angle ranges matching Google Maps, Apple Maps, etc.
DROP FUNCTION IF EXISTS get_turn_direction(double precision);
CREATE OR REPLACE FUNCTION get_turn_direction(angle_deg FLOAT)
  RETURNS TEXT AS
$func$
BEGIN
  -- Normalize angle to be between -180 and 180
  -- Use math approach instead of modulo since % doesn't work with double precision
  angle_deg := angle_deg - 360 * floor(angle_deg / 360);
  IF angle_deg > 180 THEN
    angle_deg := angle_deg - 360;
  ELSIF angle_deg <= -180 THEN
    angle_deg := angle_deg + 360;
  END IF;

  -- Industry-standard turn classification
  -- Angles measured from incoming direction (0° = straight, positive = right turn)
  RETURN CASE
    -- Straight/Continue (-20° to +20°)
    WHEN angle_deg BETWEEN -20 AND 20 THEN 'Continue straight'

    -- Right turns (positive angles)
    WHEN angle_deg BETWEEN 20 AND 45 THEN 'Turn slight right'
    WHEN angle_deg BETWEEN 45 AND 120 THEN 'Turn right'
    WHEN angle_deg BETWEEN 120 AND 160 THEN 'Turn sharp right'

    -- Left turns (negative angles)
    WHEN angle_deg BETWEEN -45 AND -20 THEN 'Turn slight left'
    WHEN angle_deg BETWEEN -120 AND -45 THEN 'Turn left'
    WHEN angle_deg BETWEEN -160 AND -120 THEN 'Turn sharp left'

    -- U-turns (>160° in either direction)
    WHEN ABS(angle_deg) > 160 THEN 'Make a U-turn'

    ELSE 'Continue'
  END;
END
$func$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to return machine-readable turn type for icons and i18n
-- Returns enum-like string values: 'straight', 'left', 'right', 'slight-left', etc.
DROP FUNCTION IF EXISTS get_turn_type(double precision);
CREATE OR REPLACE FUNCTION get_turn_type(angle_deg FLOAT)
  RETURNS TEXT AS
$func$
BEGIN
  -- Normalize angle to be between -180 and 180
  angle_deg := angle_deg - 360 * floor(angle_deg / 360);
  IF angle_deg > 180 THEN
    angle_deg := angle_deg - 360;
  ELSIF angle_deg <= -180 THEN
    angle_deg := angle_deg + 360;
  END IF;

  -- Return machine-readable type string (kebab-case for CSS classes)
  RETURN CASE
    WHEN angle_deg BETWEEN -20 AND 20 THEN 'straight'
    WHEN angle_deg BETWEEN 20 AND 45 THEN 'slight-right'
    WHEN angle_deg BETWEEN 45 AND 120 THEN 'right'
    WHEN angle_deg BETWEEN 120 AND 160 THEN 'sharp-right'
    WHEN angle_deg BETWEEN -45 AND -20 THEN 'slight-left'
    WHEN angle_deg BETWEEN -120 AND -45 THEN 'left'
    WHEN angle_deg BETWEEN -160 AND -120 THEN 'sharp-left'
    WHEN ABS(angle_deg) > 160 THEN 'u-turn'
    ELSE 'continue'
  END;
END
$func$ LANGUAGE plpgsql IMMUTABLE;

-- driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute(double precision,double precision,double precision,double precision);
CREATE FUNCTION getdrivingroute(_start_lat FLOAT,_start_lon FLOAT,_end_lat FLOAT, _end_lon FLOAT)
  RETURNS TABLE(seq            INT,
                id             VARCHAR,
                street         VARCHAR,
                travel_time    FLOAT,
                distance       FLOAT,
                turn_instruction TEXT,
                turn_type      TEXT,
                traffic_factor NUMERIC(5,2),
                geom           GEOMETRY) AS
$func$
DECLARE
  start_node INT;
  end_node INT;
BEGIN
  -- Get start and end nodes (driveable only)
  start_node := getnearestdrivenode(_start_lon, _start_lat);
  end_node := getnearestdrivenode(_end_lon, _end_lat);

  -- Validate nodes were found
  IF start_node IS NULL OR end_node IS NULL THEN
    RAISE EXCEPTION 'Could not find driveable nodes near start or end location';
  END IF;

  -- Return segments with properly processed geometries
  RETURN QUERY
  WITH ordered_edges AS (
    SELECT
      r.seq,
      r.edge,
      e.join_id,
      e.street,
      e.time_drive,
      e.length_feet,
      e.geom_4326 AS edge_geom,  -- PHASE 2: Use cached WGS84 geometry (no ST_Transform needed)
      v.geom AS node_geom
    FROM
      pgr_trsp(
        'SELECT id, source, target, cost_drive AS cost, rcost_drive as reverse_cost FROM edges WHERE driveable=TRUE',
        'SELECT path, cost FROM restrictions_for_driving',
        start_node, end_node, TRUE
      ) AS r
      JOIN edges e ON r.edge = e.id
      LEFT JOIN edges_vertices_pgr v ON r.node = v.id
    ORDER BY r.seq
  ),
  -- Calculate directions
  edges_with_bearings AS (
    SELECT
      oe.seq,
      oe.edge,
      oe.join_id,
      oe.street,
      oe.time_drive,
      oe.length_feet,
      oe.edge_geom,
      LAG(oe.node_geom) OVER (ORDER BY oe.seq) AS prev_node,
      oe.node_geom AS current_node,
      LEAD(oe.node_geom) OVER (ORDER BY oe.seq) AS next_node,
      LAG(oe.street) OVER (ORDER BY oe.seq) AS prev_street
    FROM ordered_edges oe
  ),
  -- Generate turn instructions
  edges_with_instructions AS (
    SELECT
      ewb.seq,
      ewb.join_id AS id,
      ewb.street,
      ewb.time_drive AS travel_time,
      ewb.length_feet AS distance,
      ewb.edge_geom AS transformed_geom,  -- PHASE 2: Already in WGS84 (geom_4326), no transform needed
      -- Machine-readable turn type for icons
      CASE
        WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
          get_turn_type(degrees(ST_Angle(
            ST_MakeLine(ewb.prev_node, ewb.current_node),
            ST_MakeLine(ewb.current_node, ewb.next_node)
          )))
        ELSE 'continue'
      END AS turn_type,
      -- Human-readable turn instruction
      CASE
        WHEN ewb.seq = 1 THEN 'Start'
        WHEN ewb.prev_street IS DISTINCT FROM ewb.street THEN
          CASE
            WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
              get_turn_direction(degrees(ST_Angle(
                ST_MakeLine(ewb.prev_node, ewb.current_node),
                ST_MakeLine(ewb.current_node, ewb.next_node)
              ))) || ' onto ' || ewb.street
            ELSE 'Continue onto ' || ewb.street
          END
        ELSE 'Continue on ' || ewb.street
      END AS turn_instruction,
      -- Add previous street and turn type for grouping logic
      LAG(ewb.street) OVER (ORDER BY ewb.seq) AS prev_street_for_grouping,
      LAG(CASE
        WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
          get_turn_type(degrees(ST_Angle(
            ST_MakeLine(ewb.prev_node, ewb.current_node),
            ST_MakeLine(ewb.current_node, ewb.next_node)
          )))
        ELSE 'continue'
      END) OVER (ORDER BY ewb.seq) AS prev_turn_type
    FROM edges_with_bearings ewb
  ),
  -- Identify consecutive segments on same street using gap-and-islands technique
  -- This consolidates multiple "Continue on STREET" segments into single instructions
  segments_with_groups AS (
    SELECT
      ewi.seq,
      ewi.id,
      ewi.street,
      ewi.travel_time,
      ewi.distance,
      ewi.transformed_geom,
      ewi.turn_type,
      ewi.turn_instruction,
      -- Create group ID: increment when street changes OR turn type changes to non-continue
      SUM(CASE
        WHEN ewi.street IS DISTINCT FROM ewi.prev_street_for_grouping
          OR (ewi.turn_type != 'straight' AND ewi.turn_type != 'continue')
        THEN 1
        ELSE 0
      END) OVER (ORDER BY ewi.seq) AS segment_group
    FROM edges_with_instructions ewi
  ),
  -- Group consecutive segments
  -- PERFORMANCE OPTIMIZED: Use ST_Collect instead of ST_Union (40-60% faster)
  -- and compute ST_LineMerge only once per group
  grouped_edges AS (
    SELECT
      MIN(swg.seq) AS seq,
      (array_agg(swg.id ORDER BY swg.seq))[1] AS id,
      swg.street,
      SUM(swg.travel_time) AS travel_time,
      SUM(swg.distance) AS distance,
      (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
      (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
      1.0::NUMERIC(5,2) AS traffic_factor,
      ST_Collect(swg.transformed_geom ORDER BY swg.seq) AS collected_geom
    FROM segments_with_groups swg
    GROUP BY swg.segment_group, swg.street
  ),
  -- Merge collected geometries once (eliminates redundant ST_LineMerge calls)
  merged_geometries AS (
    SELECT
      ge.seq,
      ge.id,
      ge.street,
      ge.travel_time,
      ge.distance,
      ge.turn_instruction,
      ge.turn_type,
      ge.traffic_factor,
      ST_LineMerge(ge.collected_geom) AS merged_geom
    FROM grouped_edges ge
  )
  SELECT
    mg.seq,
    mg.id,
    mg.street,
    mg.travel_time,
    mg.distance,
    mg.turn_instruction,
    mg.turn_type,
    mg.traffic_factor,
    CASE
      WHEN ST_GeometryType(mg.merged_geom) = 'ST_LineString' THEN
        mg.merged_geom
      ELSE
        ST_Multi(mg.merged_geom)
    END AS geom
  FROM
    merged_geometries mg
  ORDER BY
    mg.seq;
END
$func$ LANGUAGE plpgsql;

-- biking route with turn instructions
DROP FUNCTION IF EXISTS getbikingroute(double precision,double precision,double precision,double precision);
DROP FUNCTION IF EXISTS getbikingroute(double precision,double precision,double precision,double precision,boolean);
CREATE FUNCTION getbikingroute(_start_lat FLOAT, _start_lon FLOAT, _end_lat FLOAT, _end_lon FLOAT, _avoid_ferries BOOLEAN DEFAULT FALSE)
  RETURNS TABLE(seq          INT,
                id           VARCHAR,
                street       VARCHAR,
                travel_time  FLOAT,
                distance     FLOAT,
                turn_instruction TEXT,
                turn_type    TEXT,
                geom         GEOMETRY) AS
$func$
DECLARE
  start_node INT;
  end_node INT;
BEGIN
  -- Get start and end nodes (bikeable only)
  start_node := getnearestbikenode(_start_lon, _start_lat);
  end_node := getnearestbikenode(_end_lon, _end_lat);

  -- Validate nodes were found
  IF start_node IS NULL OR end_node IS NULL THEN
    RAISE EXCEPTION 'Could not find bikeable nodes near start or end location';
  END IF;

  -- Return segments with properly processed geometries
  RETURN QUERY
  WITH ordered_edges AS (
    SELECT
      r.seq,
      r.edge,
      e.join_id,
      e.street,
      e.time_bike,
      e.length_feet,
      e.geom_4326 AS edge_geom,  -- PHASE 2: Use cached WGS84 geometry (no ST_Transform needed)
      v.geom AS node_geom
    FROM
      pgr_trsp(
        'SELECT id, source, target, cost_bike AS cost, rcost_bike as reverse_cost FROM edges WHERE bikeable=TRUE' ||
        CASE WHEN _avoid_ferries THEN ' AND featuretyp != ''F''' ELSE '' END,
        'SELECT path, cost FROM restrictions_for_biking',
        start_node, end_node, TRUE
      ) AS r
      JOIN edges e ON r.edge = e.id
      LEFT JOIN edges_vertices_pgr v ON r.node = v.id
    ORDER BY r.seq
  ),
  -- Calculate directions
  edges_with_bearings AS (
    SELECT
      oe.seq,
      oe.edge,
      oe.join_id,
      oe.street,
      oe.time_bike,
      oe.length_feet,
      oe.edge_geom,
      LAG(oe.node_geom) OVER (ORDER BY oe.seq) AS prev_node,
      oe.node_geom AS current_node,
      LEAD(oe.node_geom) OVER (ORDER BY oe.seq) AS next_node,
      LAG(oe.street) OVER (ORDER BY oe.seq) AS prev_street
    FROM ordered_edges oe
  ),
  -- Generate turn instructions
  edges_with_instructions AS (
    SELECT
      ewb.seq,
      ewb.join_id AS id,
      ewb.street,
      ewb.time_bike AS travel_time,
      ewb.length_feet AS distance,
      ewb.edge_geom AS transformed_geom,  -- PHASE 2: Already in WGS84 (geom_4326), no transform needed
      -- Machine-readable turn type for icons
      CASE
        WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
          get_turn_type(degrees(ST_Angle(
            ST_MakeLine(ewb.prev_node, ewb.current_node),
            ST_MakeLine(ewb.current_node, ewb.next_node)
          )))
        ELSE 'continue'
      END AS turn_type,
      -- Human-readable turn instruction
      CASE
        WHEN ewb.seq = 1 THEN 'Start'
        WHEN ewb.prev_street IS DISTINCT FROM ewb.street THEN
          CASE
            WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
              get_turn_direction(degrees(ST_Angle(
                ST_MakeLine(ewb.prev_node, ewb.current_node),
                ST_MakeLine(ewb.current_node, ewb.next_node)
              ))) || ' onto ' || ewb.street
            ELSE 'Continue onto ' || ewb.street
          END
        ELSE 'Continue on ' || ewb.street
      END AS turn_instruction,
      -- Add previous street for grouping logic
      LAG(ewb.street) OVER (ORDER BY ewb.seq) AS prev_street_for_grouping
    FROM edges_with_bearings ewb
  ),
  -- Identify consecutive segments on same street using gap-and-islands technique
  segments_with_groups AS (
    SELECT
      ewi.seq,
      ewi.id,
      ewi.street,
      ewi.travel_time,
      ewi.distance,
      ewi.transformed_geom,
      ewi.turn_type,
      ewi.turn_instruction,
      -- Create group ID: increment when street changes OR turn type changes to non-continue
      SUM(CASE
        WHEN ewi.street IS DISTINCT FROM ewi.prev_street_for_grouping
          OR (ewi.turn_type != 'straight' AND ewi.turn_type != 'continue')
        THEN 1
        ELSE 0
      END) OVER (ORDER BY ewi.seq) AS segment_group
    FROM edges_with_instructions ewi
  ),
  -- Group consecutive segments
  -- PERFORMANCE OPTIMIZED: Use ST_Collect instead of ST_Union (40-60% faster)
  grouped_edges AS (
    SELECT
      MIN(swg.seq) AS seq,
      (array_agg(swg.id ORDER BY swg.seq))[1] AS id,
      swg.street,
      SUM(swg.travel_time) AS travel_time,
      SUM(swg.distance) AS distance,
      (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
      (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
      ST_Collect(swg.transformed_geom ORDER BY swg.seq) AS collected_geom
    FROM segments_with_groups swg
    GROUP BY swg.segment_group, swg.street
  ),
  -- Merge collected geometries once (eliminates redundant ST_LineMerge calls)
  merged_geometries AS (
    SELECT
      ge.seq,
      ge.id,
      ge.street,
      ge.travel_time,
      ge.distance,
      ge.turn_instruction,
      ge.turn_type,
      ST_LineMerge(ge.collected_geom) AS merged_geom
    FROM grouped_edges ge
  )
  SELECT
    mg.seq,
    mg.id,
    mg.street,
    mg.travel_time,
    mg.distance,
    mg.turn_instruction,
    mg.turn_type,
    CASE
      WHEN ST_GeometryType(mg.merged_geom) = 'ST_LineString' THEN
        mg.merged_geom
      ELSE
        ST_Multi(mg.merged_geom)
    END AS geom
  FROM
    merged_geometries mg
  ORDER BY
    mg.seq;
END
$func$ LANGUAGE plpgsql;

-- walking route with turn instructions
DROP FUNCTION IF EXISTS getwalkingroute(double precision,double precision,double precision,double precision);
DROP FUNCTION IF EXISTS getwalkingroute(double precision,double precision,double precision,double precision,boolean);
CREATE FUNCTION getwalkingroute(_start_lat FLOAT, _start_lon FLOAT, _end_lat FLOAT, _end_lon FLOAT, _avoid_ferries BOOLEAN DEFAULT FALSE)
  RETURNS TABLE(seq          INT,
                id           VARCHAR,
                street       VARCHAR,
                travel_time  FLOAT,
                distance     FLOAT,
                turn_instruction TEXT,
                turn_type    TEXT,
                geom         GEOMETRY) AS
$func$
DECLARE
  start_node INT;
  end_node INT;
BEGIN
  -- Get start and end nodes (walkable only)
  start_node := getnearestwalknode(_start_lon, _start_lat);
  end_node := getnearestwalknode(_end_lon, _end_lat);

  -- Validate nodes were found
  IF start_node IS NULL OR end_node IS NULL THEN
    RAISE EXCEPTION 'Could not find walkable nodes near start or end location';
  END IF;

  -- Return segments with properly processed geometries
  RETURN QUERY
  WITH ordered_edges AS (
    SELECT
      r.seq,
      r.edge,
      e.join_id,
      e.street,
      e.time_walk,
      e.length_feet,
      e.geom_4326 AS edge_geom,  -- PHASE 2: Use cached WGS84 geometry (no ST_Transform needed)
      v.geom AS node_geom
    FROM
      pgr_trsp(
        'SELECT id, source, target, cost_walk AS cost, rcost_walk as reverse_cost FROM edges WHERE walkable=TRUE' ||
        CASE WHEN _avoid_ferries THEN ' AND featuretyp != ''F''' ELSE '' END,
        'SELECT path, cost FROM restrictions_for_walking',
        start_node, end_node, FALSE
      ) AS r
      JOIN edges e ON r.edge = e.id
      LEFT JOIN edges_vertices_pgr v ON r.node = v.id
    ORDER BY r.seq
  ),
  -- Calculate directions
  edges_with_bearings AS (
    SELECT
      oe.seq,
      oe.edge,
      oe.join_id,
      oe.street,
      oe.time_walk,
      oe.length_feet,
      oe.edge_geom,
      LAG(oe.node_geom) OVER (ORDER BY oe.seq) AS prev_node,
      oe.node_geom AS current_node,
      LEAD(oe.node_geom) OVER (ORDER BY oe.seq) AS next_node,
      LAG(oe.street) OVER (ORDER BY oe.seq) AS prev_street
    FROM ordered_edges oe
  ),
  -- Generate turn instructions
  edges_with_instructions AS (
    SELECT
      ewb.seq,
      ewb.join_id AS id,
      ewb.street,
      ewb.time_walk AS travel_time,
      ewb.length_feet AS distance,
      ewb.edge_geom AS transformed_geom,  -- PHASE 2: Already in WGS84 (geom_4326), no transform needed
      -- Machine-readable turn type for icons
      CASE
        WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
          get_turn_type(degrees(ST_Angle(
            ST_MakeLine(ewb.prev_node, ewb.current_node),
            ST_MakeLine(ewb.current_node, ewb.next_node)
          )))
        ELSE 'continue'
      END AS turn_type,
      -- Human-readable turn instruction
      CASE
        WHEN ewb.seq = 1 THEN 'Start'
        WHEN ewb.prev_street IS DISTINCT FROM ewb.street THEN
          CASE
            WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
              get_turn_direction(degrees(ST_Angle(
                ST_MakeLine(ewb.prev_node, ewb.current_node),
                ST_MakeLine(ewb.current_node, ewb.next_node)
              ))) || ' onto ' || ewb.street
            ELSE 'Continue onto ' || ewb.street
          END
        ELSE 'Continue on ' || ewb.street
      END AS turn_instruction,
      -- Add previous street for grouping logic
      LAG(ewb.street) OVER (ORDER BY ewb.seq) AS prev_street_for_grouping
    FROM edges_with_bearings ewb
  ),
  -- Identify consecutive segments on same street using gap-and-islands technique
  segments_with_groups AS (
    SELECT
      ewi.seq,
      ewi.id,
      ewi.street,
      ewi.travel_time,
      ewi.distance,
      ewi.transformed_geom,
      ewi.turn_type,
      ewi.turn_instruction,
      -- Create group ID: increment when street changes OR turn type changes to non-continue
      SUM(CASE
        WHEN ewi.street IS DISTINCT FROM ewi.prev_street_for_grouping
          OR (ewi.turn_type != 'straight' AND ewi.turn_type != 'continue')
        THEN 1
        ELSE 0
      END) OVER (ORDER BY ewi.seq) AS segment_group
    FROM edges_with_instructions ewi
  ),
  -- Group consecutive segments
  -- PERFORMANCE OPTIMIZED: Use ST_Collect instead of ST_Union (40-60% faster)
  grouped_edges AS (
    SELECT
      MIN(swg.seq) AS seq,
      (array_agg(swg.id ORDER BY swg.seq))[1] AS id,
      swg.street,
      SUM(swg.travel_time) AS travel_time,
      SUM(swg.distance) AS distance,
      (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
      (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
      ST_Collect(swg.transformed_geom ORDER BY swg.seq) AS collected_geom
    FROM segments_with_groups swg
    GROUP BY swg.segment_group, swg.street
  ),
  -- Merge collected geometries once (eliminates redundant ST_LineMerge calls)
  merged_geometries AS (
    SELECT
      ge.seq,
      ge.id,
      ge.street,
      ge.travel_time,
      ge.distance,
      ge.turn_instruction,
      ge.turn_type,
      ST_LineMerge(ge.collected_geom) AS merged_geom
    FROM grouped_edges ge
  )
  SELECT
    mg.seq,
    mg.id,
    mg.street,
    mg.travel_time,
    mg.distance,
    mg.turn_instruction,
    mg.turn_type,
    CASE
      WHEN ST_GeometryType(mg.merged_geom) = 'ST_LineString' THEN
        mg.merged_geom
      ELSE
        ST_Multi(mg.merged_geom)
    END AS geom
  FROM
    merged_geometries mg
  ORDER BY
    mg.seq;
END
$func$ LANGUAGE plpgsql;

-- Traffic-aware driving route with turn instructions
-- Traffic factor fallback chain (Phase 19):
-- 1. edges.traffic_factor (live speed data from TrafficRefreshService)
-- 2. 1.0 default (no traffic penalty)
-- Note: Dynamic volume lookup (avg_traffic_by_segment) removed per Phase 19 audit.
DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision);

CREATE FUNCTION getdrivingroute_with_traffic(
  _start_lat FLOAT, _start_lon FLOAT,
  _end_lat FLOAT, _end_lon FLOAT,
  _hour INTEGER DEFAULT NULL,         -- Kept for backward compatibility (unused)
  _day_of_week INTEGER DEFAULT NULL   -- Kept for backward compatibility (unused)
)
RETURNS TABLE(
    seq INT,
    id VARCHAR,
    street VARCHAR,
    travel_time NUMERIC(10,2),
    distance NUMERIC(10,2),
    turn_instruction TEXT,
    turn_type TEXT,
    traffic_factor NUMERIC(5,2),
    geom GEOMETRY
) AS
$func$
DECLARE
    start_node INT;
    end_node INT;
BEGIN
    -- Get start and end nodes (driveable only)
    start_node := getnearestdrivenode(_start_lon, _start_lat);
    end_node := getnearestdrivenode(_end_lon, _end_lat);

    IF start_node IS NULL OR end_node IS NULL THEN
        RAISE EXCEPTION 'Could not find start or end node';
    END IF;

    -- Return segments with properly processed geometries
    RETURN QUERY
    WITH ordered_edges AS (
      SELECT
        r.seq,
        r.edge,
        e.join_id,
        e.street,
        e.time_drive * COALESCE(e.traffic_factor, 1.0) AS travel_time,
        e.length_feet,
        COALESCE(e.traffic_factor, 1.0) AS traffic_factor,
        e.geom_4326 AS edge_geom,  -- PHASE 2: Use cached WGS84 geometry (no ST_Transform needed)
        v.geom AS node_geom
      FROM
        pgr_trsp(
          'SELECT id, source, target,
              cost_drive * COALESCE(traffic_factor, 1.0) AS cost,
              rcost_drive * COALESCE(traffic_factor, 1.0) AS reverse_cost
          FROM edges WHERE driveable = TRUE',
          'SELECT path, cost FROM restrictions_for_driving',
          start_node, end_node, TRUE
        ) AS r
        JOIN edges e ON r.edge = e.id
        LEFT JOIN edges_vertices_pgr v ON r.node = v.id
      ORDER BY r.seq
    ),
    -- Calculate directions
    edges_with_bearings AS (
      SELECT
        oe.seq,
        oe.edge,
        oe.join_id,
        oe.street,
        oe.travel_time,
        oe.length_feet,
        oe.traffic_factor,
        oe.edge_geom,
        LAG(oe.node_geom) OVER (ORDER BY oe.seq) AS prev_node,
        oe.node_geom AS current_node,
        LEAD(oe.node_geom) OVER (ORDER BY oe.seq) AS next_node,
        LAG(oe.street) OVER (ORDER BY oe.seq) AS prev_street
      FROM ordered_edges oe
    ),
    -- Generate turn instructions
    edges_with_instructions AS (
      SELECT
        ewb.seq,
        ewb.join_id AS id,
        ewb.street,
        ewb.travel_time::numeric(10,2) AS travel_time,
        ewb.length_feet::numeric(10,2) AS distance,
        ewb.traffic_factor AS traffic_factor,
        ewb.edge_geom AS transformed_geom,  -- PHASE 2: Already in WGS84 (geom_4326), no transform needed
        CASE
          WHEN ewb.seq = 1 THEN 'Start'
          WHEN ewb.prev_street IS DISTINCT FROM ewb.street THEN
            CASE
              WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
                get_turn_direction(degrees(ST_Angle(
                  ST_MakeLine(ewb.prev_node, ewb.current_node),
                  ST_MakeLine(ewb.current_node, ewb.next_node)
                ))) || ' onto ' || ewb.street
              ELSE 'Continue onto ' || ewb.street
            END
          ELSE 'Continue on ' || ewb.street
        END AS turn_instruction,
        -- Machine-readable turn type for icons
        CASE
          WHEN ewb.prev_node IS NOT NULL AND ewb.current_node IS NOT NULL AND ewb.next_node IS NOT NULL THEN
            get_turn_type(degrees(ST_Angle(
              ST_MakeLine(ewb.prev_node, ewb.current_node),
              ST_MakeLine(ewb.current_node, ewb.next_node)
            )))
          ELSE 'continue'
        END AS turn_type,
        -- Add previous street for grouping logic
        LAG(ewb.street) OVER (ORDER BY ewb.seq) AS prev_street_for_grouping
      FROM edges_with_bearings ewb
    ),
    -- Identify consecutive segments on same street using gap-and-islands technique
    segments_with_groups AS (
      SELECT
        ewi.seq,
        ewi.id,
        ewi.street,
        ewi.travel_time,
        ewi.distance,
        ewi.traffic_factor,
        ewi.transformed_geom,
        ewi.turn_type,
        ewi.turn_instruction,
        -- Create group ID: increment when street changes OR turn type changes to non-continue
        SUM(CASE
          WHEN ewi.street IS DISTINCT FROM ewi.prev_street_for_grouping
            OR (ewi.turn_type != 'straight' AND ewi.turn_type != 'continue')
          THEN 1
          ELSE 0
        END) OVER (ORDER BY ewi.seq) AS segment_group
      FROM edges_with_instructions ewi
    ),
    -- Group consecutive segments
    -- PERFORMANCE OPTIMIZED: Use ST_Collect instead of ST_Union (40-60% faster)
    grouped_edges AS (
      SELECT
        MIN(swg.seq) AS seq,
        (array_agg(swg.id ORDER BY swg.seq))[1] AS id,
        swg.street,
        SUM(swg.travel_time) AS travel_time,
        SUM(swg.distance) AS distance,
        MAX(swg.traffic_factor) AS traffic_factor,
        (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
        (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
        ST_Collect(swg.transformed_geom ORDER BY swg.seq) AS collected_geom
      FROM segments_with_groups swg
      GROUP BY swg.segment_group, swg.street
    ),
    -- Merge collected geometries once (eliminates redundant ST_LineMerge calls)
    merged_geometries AS (
      SELECT
        ge.seq,
        ge.id,
        ge.street,
        ge.travel_time,
        ge.distance,
        ge.traffic_factor,
        ge.turn_instruction,
        ge.turn_type,
        ST_LineMerge(ge.collected_geom) AS merged_geom
      FROM grouped_edges ge
    )
    SELECT
      mg.seq,
      mg.id,
      mg.street,
      mg.travel_time,
      mg.distance,
      mg.turn_instruction,
      mg.turn_type,
      mg.traffic_factor,
      CASE
        WHEN ST_GeometryType(mg.merged_geom) = 'ST_LineString' THEN
          mg.merged_geom
        ELSE
          ST_Multi(mg.merged_geom)
      END AS geom
    FROM
      merged_geometries mg
    ORDER BY
      mg.seq;
END
$func$ LANGUAGE plpgsql;

-- ============================================================================
-- Isochrone (Reachability) Functions
-- Uses pgr_drivingDistance (Dijkstra-based, no turn restrictions) to compute
-- reachable nodes within time intervals, then ST_ConcaveHull for polygon output.
-- ============================================================================

-- Driving isochrone with optional traffic
-- Traffic factor fallback chain (Phase 19):
-- 1. edges.traffic_factor (live speed data from TrafficRefreshService)
-- 2. 1.0 default (no traffic penalty)
-- Note: Dynamic volume lookup (avg_traffic_by_segment) removed per Phase 19 audit.
DROP FUNCTION IF EXISTS getdrivingisochrone(double precision, double precision, float[], boolean, integer, integer);
CREATE OR REPLACE FUNCTION getdrivingisochrone(
    _lon FLOAT,
    _lat FLOAT,
    _intervals FLOAT[],
    _use_traffic BOOLEAN DEFAULT FALSE,
    _hour INT DEFAULT NULL,          -- Kept for backward compatibility (unused)
    _day_of_week INT DEFAULT NULL    -- Kept for backward compatibility (unused)
)
RETURNS TABLE(band_index INT, minutes FLOAT, node_count INT, geom GEOMETRY) AS
$func$
DECLARE
    start_node INT;
    max_cost FLOAT;
    bbox_buffer FLOAT;
    bbox_sql TEXT;
    edges_sql TEXT;
BEGIN
    -- Snap origin to nearest driveable node
    start_node := getnearestdrivenode(_lon, _lat);

    IF start_node IS NULL THEN
        RAISE EXCEPTION 'Could not find a driveable node near the given coordinates';
    END IF;

    -- Max cost is the largest interval
    max_cost := (SELECT MAX(v) FROM unnest(_intervals) AS v);

    -- Bounding box pre-filter: ~2500 m/min for driving (accounts for highways/expressways), minimum 5000m
    bbox_buffer := GREATEST(max_cost * 2500, 5000);
    bbox_sql := format(
        'AND the_geom && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2263), %s)',
        _lon, _lat, bbox_buffer
    );

    -- Build edges SQL with traffic factor
    IF _use_traffic THEN
        edges_sql := format(
            'SELECT id, source, target, cost_drive * COALESCE(traffic_factor, 1.0) AS cost, rcost_drive * COALESCE(traffic_factor, 1.0) AS reverse_cost FROM edges WHERE driveable = TRUE %s',
            bbox_sql
        );
    ELSE
        edges_sql := format(
            'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost FROM edges WHERE driveable = TRUE %s',
            bbox_sql
        );
    END IF;

    -- Execute pgr_drivingDistance once with max interval, then partition by thresholds
    RETURN QUERY
    WITH reachable_nodes AS (
        SELECT dd.node, dd.agg_cost
        FROM pgr_drivingDistance(edges_sql, start_node, max_cost, TRUE) dd
        WHERE dd.edge != -1
    ),
    node_geoms AS (
        SELECT rn.node, rn.agg_cost, v.geom AS the_geom
        FROM reachable_nodes rn
        JOIN edges_vertices_pgr v ON v.id = rn.node
    ),
    intervals AS (
        SELECT ROW_NUMBER() OVER (ORDER BY val) AS idx, val
        FROM unnest(_intervals) AS val
    )
    SELECT
        i.idx::INT AS band_index,
        i.val::FLOAT AS minutes,
        COUNT(ng.node)::INT AS node_count,
        CASE
            WHEN COUNT(ng.node) < 3 THEN
                ST_Transform(ST_SimplifyPreserveTopology(ST_Buffer(ST_Collect(ng.the_geom), 100), 50), 4326)
            ELSE
                ST_Transform(ST_SimplifyPreserveTopology(ST_ConcaveHull(ST_Collect(ng.the_geom), 0.8, false), 50), 4326)
        END AS geom
    FROM intervals i
    LEFT JOIN node_geoms ng ON ng.agg_cost <= i.val
    GROUP BY i.idx, i.val
    HAVING COUNT(ng.node) > 0
    ORDER BY i.idx DESC;
END
$func$ LANGUAGE plpgsql;

-- Biking isochrone
DROP FUNCTION IF EXISTS getbikingisochrone(double precision, double precision, float[]);
CREATE OR REPLACE FUNCTION getbikingisochrone(
    _lon FLOAT,
    _lat FLOAT,
    _intervals FLOAT[]
)
RETURNS TABLE(band_index INT, minutes FLOAT, node_count INT, geom GEOMETRY) AS
$func$
DECLARE
    start_node INT;
    max_cost FLOAT;
    bbox_buffer FLOAT;
    edges_sql TEXT;
BEGIN
    start_node := getnearestbikenode(_lon, _lat);

    IF start_node IS NULL THEN
        RAISE EXCEPTION 'Could not find a bikeable node near the given coordinates';
    END IF;

    max_cost := (SELECT MAX(v) FROM unnest(_intervals) AS v);

    -- Bounding box pre-filter: ~800 m/min for biking (accounts for bike lanes/downhills), minimum 5000m
    bbox_buffer := GREATEST(max_cost * 800, 5000);

    edges_sql := format(
        'SELECT id, source, target, cost_bike AS cost, rcost_bike AS reverse_cost FROM edges WHERE bikeable = TRUE AND the_geom && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2263), %s)',
        _lon, _lat, bbox_buffer
    );

    RETURN QUERY
    WITH reachable_nodes AS (
        SELECT dd.node, dd.agg_cost
        FROM pgr_drivingDistance(edges_sql, start_node, max_cost, TRUE) dd
        WHERE dd.edge != -1
    ),
    node_geoms AS (
        SELECT rn.node, rn.agg_cost, v.geom AS the_geom
        FROM reachable_nodes rn
        JOIN edges_vertices_pgr v ON v.id = rn.node
    ),
    intervals AS (
        SELECT ROW_NUMBER() OVER (ORDER BY val) AS idx, val
        FROM unnest(_intervals) AS val
    )
    SELECT
        i.idx::INT AS band_index,
        i.val::FLOAT AS minutes,
        COUNT(ng.node)::INT AS node_count,
        CASE
            WHEN COUNT(ng.node) < 3 THEN
                ST_Transform(ST_SimplifyPreserveTopology(ST_Buffer(ST_Collect(ng.the_geom), 100), 50), 4326)
            ELSE
                ST_Transform(ST_SimplifyPreserveTopology(ST_ConcaveHull(ST_Collect(ng.the_geom), 0.8, false), 50), 4326)
        END AS geom
    FROM intervals i
    LEFT JOIN node_geoms ng ON ng.agg_cost <= i.val
    GROUP BY i.idx, i.val
    HAVING COUNT(ng.node) > 0
    ORDER BY i.idx DESC;
END
$func$ LANGUAGE plpgsql;

-- Walking isochrone (undirected — pedestrians walk either direction)
DROP FUNCTION IF EXISTS getwalkingisochrone(double precision, double precision, float[]);
CREATE OR REPLACE FUNCTION getwalkingisochrone(
    _lon FLOAT,
    _lat FLOAT,
    _intervals FLOAT[]
)
RETURNS TABLE(band_index INT, minutes FLOAT, node_count INT, geom GEOMETRY) AS
$func$
DECLARE
    start_node INT;
    max_cost FLOAT;
    bbox_buffer FLOAT;
    edges_sql TEXT;
BEGIN
    start_node := getnearestwalknode(_lon, _lat);

    IF start_node IS NULL THEN
        RAISE EXCEPTION 'Could not find a walkable node near the given coordinates';
    END IF;

    max_cost := (SELECT MAX(v) FROM unnest(_intervals) AS v);

    -- Bounding box pre-filter: ~150 m/min for walking, minimum 5000m
    bbox_buffer := GREATEST(max_cost * 150, 5000);

    edges_sql := format(
        'SELECT id, source, target, cost_walk AS cost, rcost_walk AS reverse_cost FROM edges WHERE walkable = TRUE AND the_geom && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2263), %s)',
        _lon, _lat, bbox_buffer
    );

    RETURN QUERY
    WITH reachable_nodes AS (
        SELECT dd.node, dd.agg_cost
        FROM pgr_drivingDistance(edges_sql, start_node, max_cost, FALSE) dd
        WHERE dd.edge != -1
    ),
    node_geoms AS (
        SELECT rn.node, rn.agg_cost, v.geom AS the_geom
        FROM reachable_nodes rn
        JOIN edges_vertices_pgr v ON v.id = rn.node
    ),
    intervals AS (
        SELECT ROW_NUMBER() OVER (ORDER BY val) AS idx, val
        FROM unnest(_intervals) AS val
    )
    SELECT
        i.idx::INT AS band_index,
        i.val::FLOAT AS minutes,
        COUNT(ng.node)::INT AS node_count,
        CASE
            WHEN COUNT(ng.node) < 3 THEN
                ST_Transform(ST_SimplifyPreserveTopology(ST_Buffer(ST_Collect(ng.the_geom), 100), 50), 4326)
            ELSE
                ST_Transform(ST_SimplifyPreserveTopology(ST_ConcaveHull(ST_Collect(ng.the_geom), 0.8, false), 50), 4326)
        END AS geom
    FROM intervals i
    LEFT JOIN node_geoms ng ON ng.agg_cost <= i.val
    GROUP BY i.idx, i.val
    HAVING COUNT(ng.node) > 0
    ORDER BY i.idx DESC;
END
$func$ LANGUAGE plpgsql;

-- ============================================================================
-- EDGE-BASED ISOCHRONE FUNCTIONS
-- Return individual street geometries instead of hull polygons.
-- Each reachable edge includes: edge_id, band_index, agg_cost, street name, geometry
-- ============================================================================

-- Driving edge isochrone with optional traffic
-- Traffic factor fallback chain (Phase 19):
-- 1. edges.traffic_factor (live speed data from TrafficRefreshService)
-- 2. 1.0 default (no traffic penalty)
-- Note: Dynamic volume lookup (avg_traffic_by_segment) removed per Phase 19 audit.
DROP FUNCTION IF EXISTS getdrivingisochrone_edges(double precision, double precision, float[], boolean, integer, integer);
CREATE OR REPLACE FUNCTION getdrivingisochrone_edges(
    _lon FLOAT,
    _lat FLOAT,
    _intervals FLOAT[],
    _use_traffic BOOLEAN DEFAULT FALSE,
    _hour INT DEFAULT NULL,          -- Kept for backward compatibility (unused)
    _day_of_week INT DEFAULT NULL    -- Kept for backward compatibility (unused)
)
RETURNS TABLE(edge_id INT, band_index INT, agg_cost FLOAT, street TEXT, geom GEOMETRY) AS
$func$
DECLARE
    start_node INT;
    max_cost FLOAT;
    bbox_buffer FLOAT;
    bbox_sql TEXT;
    edges_sql TEXT;
BEGIN
    -- Snap origin to nearest driveable node
    start_node := getnearestdrivenode(_lon, _lat);

    IF start_node IS NULL THEN
        RAISE EXCEPTION 'Could not find a driveable node near the given coordinates';
    END IF;

    -- Max cost is the largest interval
    max_cost := (SELECT MAX(v) FROM unnest(_intervals) AS v);

    -- Bounding box pre-filter: ~2500 m/min for driving (accounts for highways/expressways), minimum 5000m
    bbox_buffer := GREATEST(max_cost * 2500, 5000);
    bbox_sql := format(
        'AND the_geom && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2263), %s)',
        _lon, _lat, bbox_buffer
    );

    -- Build edges SQL with traffic factor
    IF _use_traffic THEN
        edges_sql := format(
            'SELECT id, source, target, cost_drive * COALESCE(traffic_factor, 1.0) AS cost, rcost_drive * COALESCE(traffic_factor, 1.0) AS reverse_cost FROM edges WHERE driveable = TRUE %s',
            bbox_sql
        );
    ELSE
        edges_sql := format(
            'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost FROM edges WHERE driveable = TRUE %s',
            bbox_sql
        );
    END IF;

    -- Execute pgr_drivingDistance once with max interval, then partition edges by band
    RETURN QUERY
    WITH reachable_edges AS (
        SELECT dd.edge AS eid, dd.agg_cost
        FROM pgr_drivingDistance(edges_sql, start_node, max_cost, TRUE) dd
        WHERE dd.edge != -1
    ),
    edge_geoms AS (
        SELECT DISTINCT ON (re.eid)
            re.eid,
            re.agg_cost,
            e.street,
            ST_Transform(ST_SimplifyPreserveTopology(e.the_geom, 1), 4326) AS the_geom
        FROM reachable_edges re
        JOIN edges e ON e.id = re.eid
        ORDER BY re.eid, re.agg_cost
    ),
    intervals AS (
        SELECT ROW_NUMBER() OVER (ORDER BY val) AS idx, val
        FROM unnest(_intervals) AS val
    )
    SELECT
        eg.eid::INT AS edge_id,
        i.idx::INT AS band_index,
        eg.agg_cost::FLOAT AS agg_cost,
        eg.street::TEXT AS street,
        eg.the_geom AS geom
    FROM intervals i
    JOIN edge_geoms eg ON eg.agg_cost <= i.val
        AND (i.idx = 1 OR eg.agg_cost > COALESCE(
            (SELECT val FROM intervals WHERE idx = i.idx - 1), 0
        ))
    ORDER BY i.idx, eg.agg_cost;
END
$func$ LANGUAGE plpgsql;

-- Biking edge isochrone
DROP FUNCTION IF EXISTS getbikingisochrone_edges(double precision, double precision, float[]);
CREATE OR REPLACE FUNCTION getbikingisochrone_edges(
    _lon FLOAT,
    _lat FLOAT,
    _intervals FLOAT[]
)
RETURNS TABLE(edge_id INT, band_index INT, agg_cost FLOAT, street TEXT, geom GEOMETRY) AS
$func$
DECLARE
    start_node INT;
    max_cost FLOAT;
    bbox_buffer FLOAT;
    edges_sql TEXT;
BEGIN
    start_node := getnearestbikenode(_lon, _lat);

    IF start_node IS NULL THEN
        RAISE EXCEPTION 'Could not find a bikeable node near the given coordinates';
    END IF;

    max_cost := (SELECT MAX(v) FROM unnest(_intervals) AS v);

    -- Bounding box pre-filter: ~800 m/min for biking (accounts for bike lanes/downhills), minimum 5000m
    bbox_buffer := GREATEST(max_cost * 800, 5000);

    edges_sql := format(
        'SELECT id, source, target, cost_bike AS cost, rcost_bike AS reverse_cost FROM edges WHERE bikeable = TRUE AND the_geom && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2263), %s)',
        _lon, _lat, bbox_buffer
    );

    RETURN QUERY
    WITH reachable_edges AS (
        SELECT dd.edge AS eid, dd.agg_cost
        FROM pgr_drivingDistance(edges_sql, start_node, max_cost, TRUE) dd
        WHERE dd.edge != -1
    ),
    edge_geoms AS (
        SELECT DISTINCT ON (re.eid)
            re.eid,
            re.agg_cost,
            e.street,
            ST_Transform(ST_SimplifyPreserveTopology(e.the_geom, 1), 4326) AS the_geom
        FROM reachable_edges re
        JOIN edges e ON e.id = re.eid
        ORDER BY re.eid, re.agg_cost
    ),
    intervals AS (
        SELECT ROW_NUMBER() OVER (ORDER BY val) AS idx, val
        FROM unnest(_intervals) AS val
    )
    SELECT
        eg.eid::INT AS edge_id,
        i.idx::INT AS band_index,
        eg.agg_cost::FLOAT AS agg_cost,
        eg.street::TEXT AS street,
        eg.the_geom AS geom
    FROM intervals i
    JOIN edge_geoms eg ON eg.agg_cost <= i.val
        AND (i.idx = 1 OR eg.agg_cost > COALESCE(
            (SELECT val FROM intervals WHERE idx = i.idx - 1), 0
        ))
    ORDER BY i.idx, eg.agg_cost;
END
$func$ LANGUAGE plpgsql;

-- Walking edge isochrone (undirected -- pedestrians walk either direction)
DROP FUNCTION IF EXISTS getwalkingisochrone_edges(double precision, double precision, float[]);
CREATE OR REPLACE FUNCTION getwalkingisochrone_edges(
    _lon FLOAT,
    _lat FLOAT,
    _intervals FLOAT[]
)
RETURNS TABLE(edge_id INT, band_index INT, agg_cost FLOAT, street TEXT, geom GEOMETRY) AS
$func$
DECLARE
    start_node INT;
    max_cost FLOAT;
    bbox_buffer FLOAT;
    edges_sql TEXT;
BEGIN
    start_node := getnearestwalknode(_lon, _lat);

    IF start_node IS NULL THEN
        RAISE EXCEPTION 'Could not find a walkable node near the given coordinates';
    END IF;

    max_cost := (SELECT MAX(v) FROM unnest(_intervals) AS v);

    -- Bounding box pre-filter: ~150 m/min for walking, minimum 5000m
    bbox_buffer := GREATEST(max_cost * 150, 5000);

    edges_sql := format(
        'SELECT id, source, target, cost_walk AS cost, rcost_walk AS reverse_cost FROM edges WHERE walkable = TRUE AND the_geom && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2263), %s)',
        _lon, _lat, bbox_buffer
    );

    RETURN QUERY
    WITH reachable_edges AS (
        SELECT dd.edge AS eid, dd.agg_cost
        FROM pgr_drivingDistance(edges_sql, start_node, max_cost, FALSE) dd
        WHERE dd.edge != -1
    ),
    edge_geoms AS (
        SELECT DISTINCT ON (re.eid)
            re.eid,
            re.agg_cost,
            e.street,
            ST_Transform(ST_SimplifyPreserveTopology(e.the_geom, 1), 4326) AS the_geom
        FROM reachable_edges re
        JOIN edges e ON e.id = re.eid
        ORDER BY re.eid, re.agg_cost
    ),
    intervals AS (
        SELECT ROW_NUMBER() OVER (ORDER BY val) AS idx, val
        FROM unnest(_intervals) AS val
    )
    SELECT
        eg.eid::INT AS edge_id,
        i.idx::INT AS band_index,
        eg.agg_cost::FLOAT AS agg_cost,
        eg.street::TEXT AS street,
        eg.the_geom AS geom
    FROM intervals i
    JOIN edge_geoms eg ON eg.agg_cost <= i.val
        AND (i.idx = 1 OR eg.agg_cost > COALESCE(
            (SELECT val FROM intervals WHERE idx = i.idx - 1), 0
        ))
    ORDER BY i.idx, eg.agg_cost;
END
$func$ LANGUAGE plpgsql;

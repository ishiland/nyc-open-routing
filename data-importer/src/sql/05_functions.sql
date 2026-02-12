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
      swg.id,
      swg.street,
      SUM(swg.travel_time) AS travel_time,
      SUM(swg.distance) AS distance,
      (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
      (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
      1.0::NUMERIC(5,2) AS traffic_factor,
      ST_Collect(swg.transformed_geom) AS collected_geom  -- Faster: O(n) vs O(n log n)
    FROM segments_with_groups swg
    GROUP BY swg.segment_group, swg.id, swg.street
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
      swg.id,
      swg.street,
      SUM(swg.travel_time) AS travel_time,
      SUM(swg.distance) AS distance,
      (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
      (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
      ST_Collect(swg.transformed_geom) AS collected_geom
    FROM segments_with_groups swg
    GROUP BY swg.segment_group, swg.id, swg.street
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
      swg.id,
      swg.street,
      SUM(swg.travel_time) AS travel_time,
      SUM(swg.distance) AS distance,
      (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
      (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
      ST_Collect(swg.transformed_geom) AS collected_geom
    FROM segments_with_groups swg
    GROUP BY swg.segment_group, swg.id, swg.street
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

-- traffic-aware driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision);

CREATE FUNCTION getdrivingroute_with_traffic(
  _start_lat FLOAT, _start_lon FLOAT,
  _end_lat FLOAT, _end_lon FLOAT,
  _hour INTEGER DEFAULT NULL,         -- Hour of day (0-23), NULL = use static traffic_factor
  _day_of_week INTEGER DEFAULT NULL   -- Day of week (1-7 = Mon-Sun), NULL = use static traffic_factor
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
    use_dynamic_traffic BOOLEAN;
    hour_condition_sql TEXT := 'TRUE';
    day_condition_sql TEXT := 'TRUE';
    traffic_lookup_sql TEXT;
    edges_sql TEXT;
BEGIN
    -- Get start and end nodes (driveable only)
    start_node := getnearestdrivenode(_start_lon, _start_lat);
    end_node := getnearestdrivenode(_end_lon, _end_lat);

    -- Determine if we're using time-based dynamic traffic or static factors
    use_dynamic_traffic := (_hour IS NOT NULL AND _day_of_week IS NOT NULL);

    IF start_node IS NULL OR end_node IS NULL THEN
        RAISE EXCEPTION 'Could not find start or end node';
    END IF;

    IF use_dynamic_traffic THEN
        hour_condition_sql := format('hour_of_day = %s', _hour);
        day_condition_sql := format('day_of_week = %s', _day_of_week);
    END IF;

    traffic_lookup_sql := format($fmt$
        COALESCE(
            (SELECT
                CASE
                    WHEN avg_volume < 58 THEN 1.0
                    WHEN avg_volume < 129 THEN 1.2
                    WHEN avg_volume < 250 THEN 1.5
                    WHEN avg_volume < 415 THEN 2.0
                    ELSE 3.0
                END
             FROM avg_traffic_by_segment
             WHERE segment_id = segmentid
               AND %1$s
               AND %2$s
             LIMIT 1
            ), 1.0)$fmt$,
        hour_condition_sql,
        day_condition_sql
    );

    edges_sql := format($fmt$
        SELECT id, source, target,
            cost_drive * CASE
                WHEN %1$s THEN %2$s
                ELSE COALESCE(traffic_factor, 1.0)
            END AS cost,
            rcost_drive * CASE
                WHEN %1$s THEN %2$s
                ELSE COALESCE(traffic_factor, 1.0)
            END AS reverse_cost
        FROM edges
        WHERE driveable = TRUE$fmt$,
        CASE WHEN use_dynamic_traffic THEN 'TRUE' ELSE 'FALSE' END,
        traffic_lookup_sql
    );

    -- Return segments with properly processed geometries
    RETURN QUERY
    WITH ordered_edges AS (
      SELECT
        r.seq,
        r.edge,
        e.join_id,
        e.street,
        -- Calculate traffic multiplier inline, only for route edges
        -- This eliminates the 300k-row CTE materialization
        e.time_drive * CASE
          WHEN use_dynamic_traffic THEN
            COALESCE(
              (SELECT
                CASE
                  WHEN avg_volume < 58 THEN 1.0
                  WHEN avg_volume < 129 THEN 1.2
                  WHEN avg_volume < 250 THEN 1.5
                  WHEN avg_volume < 415 THEN 2.0
                  ELSE 3.0
                END
               FROM avg_traffic_by_segment
               WHERE segment_id = e.segmentid
                 AND (_hour IS NULL OR hour_of_day = _hour)
                 AND (_day_of_week IS NULL OR day_of_week = _day_of_week)
               LIMIT 1
              ), 1.0)
          ELSE
            COALESCE(e.traffic_factor, 1.0)
        END AS travel_time,
        e.length_feet,
        CASE
          WHEN use_dynamic_traffic THEN
            COALESCE(
              (SELECT
                CASE
                  WHEN avg_volume < 58 THEN 1.0
                  WHEN avg_volume < 129 THEN 1.2
                  WHEN avg_volume < 250 THEN 1.5
                  WHEN avg_volume < 415 THEN 2.0
                  ELSE 3.0
                END
               FROM avg_traffic_by_segment
               WHERE segment_id = e.segmentid
                 AND (_hour IS NULL OR hour_of_day = _hour)
                 AND (_day_of_week IS NULL OR day_of_week = _day_of_week)
               LIMIT 1
              ), 1.0)
          ELSE
            COALESCE(e.traffic_factor, 1.0)
        END AS traffic_factor,
        e.geom_4326 AS edge_geom,  -- PHASE 2: Use cached WGS84 geometry (no ST_Transform needed)
        v.geom AS node_geom
      FROM
        pgr_trsp(
          -- Embed traffic lookup in pgr_trsp SQL for routing cost calculation
          -- Accept 2× lookups (routing + display) as acceptable with composite index (~1ms each)
          edges_sql,
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
        swg.id,
        swg.street,
        SUM(swg.travel_time) AS travel_time,
        SUM(swg.distance) AS distance,
        MAX(swg.traffic_factor) AS traffic_factor,
        -- Use FIRST_VALUE to preserve first instruction, not MIN (which sorts lexicographically)
        -- This prevents "Start" from being replaced by "Continue..."
        (array_agg(swg.turn_instruction ORDER BY swg.seq))[1] AS turn_instruction,
        (array_agg(swg.turn_type ORDER BY swg.seq))[1] AS turn_type,
        ST_Collect(swg.transformed_geom) AS collected_geom
      FROM segments_with_groups swg
      GROUP BY swg.segment_group, swg.id, swg.street
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

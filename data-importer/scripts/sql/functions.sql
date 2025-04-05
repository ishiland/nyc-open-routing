-- get nearest node - used by all routing functions.
-- First drop the existing function to allow parameter changes
DROP FUNCTION IF EXISTS getnearestnode(double precision, double precision);

CREATE OR REPLACE FUNCTION getnearestnode(_lon FLOAT, _lat FLOAT)
  RETURNS INT AS
$func$
BEGIN
  RETURN
  (SELECT v.id
   FROM
     edges_vertices_pgr AS v,
     edges AS e
   WHERE
     v.id = (SELECT id
             FROM edges_vertices_pgr
             ORDER BY the_geom <-> ST_Transform(ST_SetSRID(ST_MakePoint(_lon, _lat), 4326), 2263)
             LIMIT 1)
     AND (e.source = v.id OR e.target = v.id)
   GROUP BY v.id);
END
$func$ LANGUAGE plpgsql;

-- Helper function to determine turn direction based on angle
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

  -- Determine turn direction based on angle
  RETURN CASE
    WHEN angle_deg BETWEEN -20 AND 20 THEN 'Continue straight'
    WHEN angle_deg BETWEEN 20 AND 60 THEN 'Turn right'
    WHEN angle_deg BETWEEN 60 AND 120 THEN 'Turn sharp right'
    WHEN angle_deg BETWEEN -60 AND -20 THEN 'Turn left'
    WHEN angle_deg BETWEEN -120 AND -60 THEN 'Turn sharp left'
    WHEN ABS(angle_deg) > 150 THEN 'Make a U-turn'
    WHEN angle_deg > 120 THEN 'Turn slight right'
    WHEN angle_deg < -120 THEN 'Turn slight left'
    ELSE 'Continue'
  END;
END
$func$ LANGUAGE plpgsql;

-- driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute(double precision,double precision,double precision,double precision);
CREATE FUNCTION getdrivingroute(_start_lon FLOAT, _start_lat FLOAT, _end_lon FLOAT, _end_lat FLOAT)
  RETURNS TABLE(seq            INT,
                id             VARCHAR,
                street         VARCHAR,
                travel_time    FLOAT,
                distance       FLOAT,
                turn_instruction TEXT,
                geom           GEOMETRY) AS
$func$
DECLARE
  start_node INT;
  end_node INT;
BEGIN
  -- Get start and end nodes
  start_node := getnearestnode(_start_lon, _start_lat);
  end_node := getnearestnode(_end_lon, _end_lat);

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
      e.the_geom AS edge_geom,
      v.the_geom AS node_geom
    FROM
      pgr_dijkstra('SELECT id, source, target, cost_drive AS cost, rcost_drive as reverse_cost FROM edges where driveable=TRUE',
           start_node, end_node, directed := TRUE) AS r
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
      ST_Transform(ewb.edge_geom, 4326) AS transformed_geom,
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
      END AS turn_instruction
    FROM edges_with_bearings ewb
  ),
  -- Group by street segments
  grouped_edges AS (
    SELECT
      MIN(ewi.seq) AS seq,
      ewi.id,
      ewi.street,
      SUM(ewi.travel_time) AS travel_time,
      SUM(ewi.distance) AS distance,
      MIN(ewi.turn_instruction) AS turn_instruction,
      ST_Union(ewi.transformed_geom) AS combined_geom
    FROM 
      edges_with_instructions ewi
    GROUP BY
      ewi.id, ewi.street, ewi.turn_instruction
  )
  SELECT
    ge.seq,
    ge.id,
    ge.street,
    ge.travel_time,
    ge.distance,
    ge.turn_instruction,
    CASE
      WHEN ST_GeometryType(ST_LineMerge(ge.combined_geom)) = 'ST_LineString' THEN 
        ST_LineMerge(ge.combined_geom)
      ELSE
        ST_Multi(ST_LineMerge(ge.combined_geom))
    END AS geom
  FROM
    grouped_edges ge
  ORDER BY
    ge.seq;
END
$func$ LANGUAGE plpgsql;

-- biking route with turn instructions
DROP FUNCTION IF EXISTS getbikingroute(double precision,double precision,double precision,double precision);
CREATE FUNCTION getbikingroute(_start_lon FLOAT, _start_lat FLOAT, _end_lon FLOAT, _end_lat FLOAT)
  RETURNS TABLE(seq          INT,
                id           VARCHAR,
                street       VARCHAR,
                travel_time  FLOAT,
                distance     FLOAT,
                turn_instruction TEXT,
                geom         GEOMETRY) AS
$func$
DECLARE
  start_node INT;
  end_node INT;
BEGIN
  -- Get start and end nodes
  start_node := getnearestnode(_start_lon, _start_lat);
  end_node := getnearestnode(_end_lon, _end_lat);

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
      e.the_geom AS edge_geom,
      v.the_geom AS node_geom
    FROM
      pgr_dijkstra('SELECT id, source, target, cost_bike AS cost, rcost_bike as reverse_cost FROM edges where bikeable=TRUE',
           start_node, end_node, directed := TRUE) AS r
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
      ST_Transform(ewb.edge_geom, 4326) AS transformed_geom,
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
      END AS turn_instruction
    FROM edges_with_bearings ewb
  ),
  -- Group by street segments
  grouped_edges AS (
    SELECT
      MIN(ewi.seq) AS seq,
      ewi.id,
      ewi.street,
      SUM(ewi.travel_time) AS travel_time,
      SUM(ewi.distance) AS distance,
      MIN(ewi.turn_instruction) AS turn_instruction,
      ST_Union(ewi.transformed_geom) AS combined_geom
    FROM 
      edges_with_instructions ewi
    GROUP BY
      ewi.id, ewi.street, ewi.turn_instruction
  )
  SELECT
    ge.seq,
    ge.id,
    ge.street,
    ge.travel_time,
    ge.distance,
    ge.turn_instruction,
    CASE
      WHEN ST_GeometryType(ST_LineMerge(ge.combined_geom)) = 'ST_LineString' THEN 
        ST_LineMerge(ge.combined_geom)
      ELSE
        ST_Multi(ST_LineMerge(ge.combined_geom))
    END AS geom
  FROM
    grouped_edges ge
  ORDER BY
    ge.seq;
END
$func$ LANGUAGE plpgsql;

-- walking route with turn instructions
DROP FUNCTION IF EXISTS getwalkingroute(double precision,double precision,double precision,double precision);
CREATE FUNCTION getwalkingroute(_start_lon FLOAT, _start_lat FLOAT, _end_lon FLOAT, _end_lat FLOAT)
  RETURNS TABLE(seq          INT,
                id           VARCHAR,
                street       VARCHAR,
                travel_time  FLOAT,
                distance     FLOAT,
                turn_instruction TEXT,
                geom         GEOMETRY) AS
$func$
DECLARE
  start_node INT;
  end_node INT;
BEGIN
  -- Get start and end nodes
  start_node := getnearestnode(_start_lon, _start_lat);
  end_node := getnearestnode(_end_lon, _end_lat);

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
      e.the_geom AS edge_geom,
      v.the_geom AS node_geom
    FROM
      pgr_dijkstra('SELECT id, source, target, cost_walk AS cost FROM edges where walkable=TRUE',
           start_node, end_node, directed := FALSE) AS r
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
      ST_Transform(ewb.edge_geom, 4326) AS transformed_geom,
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
      END AS turn_instruction
    FROM edges_with_bearings ewb
  ),
  -- Group by street segments
  grouped_edges AS (
    SELECT
      MIN(ewi.seq) AS seq,
      ewi.id,
      ewi.street,
      SUM(ewi.travel_time) AS travel_time,
      SUM(ewi.distance) AS distance,
      MIN(ewi.turn_instruction) AS turn_instruction,
      ST_Union(ewi.transformed_geom) AS combined_geom
    FROM 
      edges_with_instructions ewi
    GROUP BY
      ewi.id, ewi.street, ewi.turn_instruction
  )
  SELECT
    ge.seq,
    ge.id,
    ge.street,
    ge.travel_time,
    ge.distance,
    ge.turn_instruction,
    CASE
      WHEN ST_GeometryType(ST_LineMerge(ge.combined_geom)) = 'ST_LineString' THEN 
        ST_LineMerge(ge.combined_geom)
      ELSE
        ST_Multi(ST_LineMerge(ge.combined_geom))
    END AS geom
  FROM
    grouped_edges ge
  ORDER BY
    ge.seq;
END
$func$ LANGUAGE plpgsql;

-- traffic-aware driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision, integer, integer);

CREATE FUNCTION getdrivingroute_with_traffic(
    _start_lon FLOAT, _start_lat FLOAT, 
    _end_lon FLOAT, _end_lat FLOAT,
    _hour INTEGER, _day_of_week INTEGER)
RETURNS TABLE(
    seq INT,
    id VARCHAR,
    street VARCHAR, 
    travel_time NUMERIC(10,2),
    distance NUMERIC(10,2),
    traffic_factor NUMERIC(10,2),
    turn_instruction TEXT,
    geom GEOMETRY
) AS
$func$
DECLARE
    start_node INT;
    end_node INT;
BEGIN
    -- Get start and end nodes 
    start_node := getnearestnode(_start_lon, _start_lat);
    end_node := getnearestnode(_end_lon, _end_lat);
    
    -- Log nodes for debugging
    RAISE NOTICE 'Start node: %, End node: %', start_node, end_node;
    
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
        e.time_drive * e.traffic_factor AS travel_time,
        e.length_feet,
        e.traffic_factor,
        e.the_geom AS edge_geom,
        v.the_geom AS node_geom
      FROM
        pgr_dijkstra('SELECT id, source, target, cost_drive * traffic_factor AS cost, rcost_drive * traffic_factor AS reverse_cost FROM edges where driveable=TRUE',
             start_node, end_node, directed := TRUE) AS r
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
        ewb.traffic_factor::numeric(10,2) AS traffic_factor,
        ST_Transform(ewb.edge_geom, 4326) AS transformed_geom,
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
        END AS turn_instruction
      FROM edges_with_bearings ewb
    ),
    -- Group by street segments
    grouped_edges AS (
      SELECT
        MIN(ewi.seq) AS seq,
        ewi.id,
        ewi.street,
        SUM(ewi.travel_time) AS travel_time,
        SUM(ewi.distance) AS distance,
        AVG(ewi.traffic_factor) AS traffic_factor,
        MIN(ewi.turn_instruction) AS turn_instruction,
        ST_Union(ewi.transformed_geom) AS combined_geom
      FROM 
        edges_with_instructions ewi
      GROUP BY
        ewi.id, ewi.street, ewi.turn_instruction
    )
    SELECT
      ge.seq,
      ge.id,
      ge.street,
      ge.travel_time,
      ge.distance,
      ge.traffic_factor,
      ge.turn_instruction,
      CASE
        WHEN ST_GeometryType(ST_LineMerge(ge.combined_geom)) = 'ST_LineString' THEN 
          ST_LineMerge(ge.combined_geom)
        ELSE
          ST_Multi(ST_LineMerge(ge.combined_geom))
      END AS geom
    FROM
      grouped_edges ge
    ORDER BY
      ge.seq;
END
$func$ LANGUAGE plpgsql;

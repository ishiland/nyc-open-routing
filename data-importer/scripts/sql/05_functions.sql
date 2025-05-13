-- get nearest node - used by all routing functions.
-- First drop the existing function to allow parameter changes
DROP FUNCTION IF EXISTS getnearestnode(double precision, double precision);

CREATE OR REPLACE FUNCTION getnearestnode(lon_param FLOAT, lat_param FLOAT)
RETURNS INTEGER AS $$
  SELECT id FROM edges_vertices_pgr ORDER BY edges_vertices_pgr.the_geom_4326 <-> ST_SetSRID(ST_MakePoint(lon_param, lat_param), 4326) LIMIT 1;
$$ LANGUAGE SQL IMMUTABLE;

-- Helper function to determine turn direction based on angle
-- DROP FUNCTION IF EXISTS get_turn_direction(double precision);

-- Generic routing function
-- Drop old signature (6 parameters)
-- DROP FUNCTION IF EXISTS _getroute(TEXT, TEXT, double precision, double precision, double precision, double precision);
-- Drop new signature (7 parameters) for idempotency
-- DROP FUNCTION IF EXISTS _getroute(TEXT, TEXT, TEXT, double precision, double precision, double precision, double precision);

-- driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute(double precision,double precision,double precision,double precision);
CREATE OR REPLACE FUNCTION getdrivingroute(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  WITH
    start_node AS (SELECT getnearestnode(lon1, lat1) AS node),
    finish_node AS (SELECT getnearestnode(lon2, lat2) AS node),
    route AS (
      SELECT * FROM pgr_dijkstra(
        'SELECT id, source, target, cost_drive, rcost_drive FROM edges WHERE cost_drive IS NOT NULL AND rcost_drive IS NOT NULL', -- Added WHERE clause for safety
        (SELECT node FROM start_node),
        (SELECT node FROM finish_node),
        directed := true
      )
    )
  SELECT
    r.seq, r.edge AS edge_id, e.street, e.cost_drive AS cost, e.the_geom_4326 AS geom
  FROM route r JOIN edges e ON r.edge = e.id
  ORDER BY r.seq;
$$ LANGUAGE SQL IMMUTABLE;

-- biking route with turn instructions
DROP FUNCTION IF EXISTS getbikingroute(double precision,double precision,double precision,double precision);
CREATE OR REPLACE FUNCTION getbikingroute(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  WITH
    start_node AS (SELECT getnearestnode(lon1, lat1) AS node),
    finish_node AS (SELECT getnearestnode(lon2, lat2) AS node),
    route AS (
      SELECT * FROM pgr_dijkstra(
        'SELECT id, source, target, cost_bike, rcost_bike FROM edges WHERE cost_bike IS NOT NULL AND rcost_bike IS NOT NULL', -- Added WHERE clause for safety
        (SELECT node FROM start_node),
        (SELECT node FROM finish_node),
        directed := true
      )
    )
  SELECT
    r.seq, r.edge AS edge_id, e.street, e.cost_bike AS cost, e.the_geom_4326 AS geom
  FROM route r JOIN edges e ON r.edge = e.id
  ORDER BY r.seq;
$$ LANGUAGE SQL IMMUTABLE;

-- walking route with turn instructions
DROP FUNCTION IF EXISTS getwalkingroute(double precision,double precision,double precision,double precision);
CREATE OR REPLACE FUNCTION getwalkingroute(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  WITH
    start_node AS (SELECT getnearestnode(lon1, lat1) AS node),
    finish_node AS (SELECT getnearestnode(lon2, lat2) AS node),
    route AS (
      SELECT * FROM pgr_dijkstra(
        'SELECT id, source, target, cost_walk, rcost_walk FROM edges WHERE cost_walk IS NOT NULL AND rcost_walk IS NOT NULL', -- Added WHERE clause for safety
        (SELECT node FROM start_node),
        (SELECT node FROM finish_node),
        directed := true
      )
    )
  SELECT
    r.seq, r.edge AS edge_id, e.street, e.cost_walk AS cost, e.the_geom_4326 AS geom
  FROM route r JOIN edges e ON r.edge = e.id
  ORDER BY r.seq;
$$ LANGUAGE SQL IMMUTABLE;

-- traffic-aware driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision, integer, integer);

DROP FUNCTION IF EXISTS getdrivingroute_current_traffic(double precision, double precision, double precision, double precision);

-- Add user-friendly function aliases
DROP FUNCTION IF EXISTS drive_route(double precision, double precision, double precision, double precision);
CREATE OR REPLACE FUNCTION drive_route(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  SELECT * FROM getdrivingroute(lon1, lat1, lon2, lat2);
$$ LANGUAGE SQL IMMUTABLE;

DROP FUNCTION IF EXISTS bike_route(double precision, double precision, double precision, double precision);
CREATE OR REPLACE FUNCTION bike_route(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  SELECT * FROM getbikingroute(lon1, lat1, lon2, lat2);
$$ LANGUAGE SQL IMMUTABLE;

DROP FUNCTION IF EXISTS walk_route(double precision, double precision, double precision, double precision);
CREATE OR REPLACE FUNCTION walk_route(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  SELECT * FROM getwalkingroute(lon1, lat1, lon2, lat2);
$$ LANGUAGE SQL IMMUTABLE; 
-- get nearest node - used by all routing functions.
CREATE OR REPLACE FUNCTION getnearestnode(_lat FLOAT, _lon FLOAT)
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
             ORDER BY the_geom <-> ST_SetSRID(ST_MakePoint(_lat, _lon), 4326)
             LIMIT 1)
     AND (e.source = v.id OR e.target = v.id)
   GROUP BY v.id);
END
$func$ LANGUAGE plpgsql;


-- driving route
DROP FUNCTION IF EXISTS getdrivingroute(double precision,double precision,double precision,double precision);
CREATE FUNCTION getdrivingroute(_start_lat FLOAT, _start_lon FLOAT, _end_lat FLOAT, _end_lon FLOAT)
  RETURNS TABLE(seq            INT,
                id             VARCHAR,
                street         VARCHAR,
                feature_type   VARCHAR,
                directionality VARCHAR,
                travel_time    FLOAT,
                distance       FLOAT,
                geom           GEOMETRY) AS
$func$
BEGIN
  RETURN QUERY
  SELECT
    min(r.seq)             AS seq,
    e.join_id              AS id,
    e.street,
    e.featuretyp           AS feature_type,
    e.one_way              AS directionality,
    sum(e.time_drive)      AS travel_time,
    sum(e.length_feet)     AS distance,
    ST_Collect(e.the_geom) AS geom
  FROM pgr_dijkstra(
           'SELECT id, source, target, cost_drive AS cost, rcost_drive as reverse_cost FROM edges where driveable=TRUE',
           getnearestnode(_start_lat, _start_lon),
           getnearestnode(_end_lat, _end_lon),
           directed := TRUE) AS r,
    edges AS e
  WHERE r.edge = e.id
  GROUP BY e.join_id, e.street, e.featuretyp, e.one_way
  ORDER BY seq;
END
$func$ LANGUAGE plpgsql;


-- biking route
DROP FUNCTION IF EXISTS getbikingroute(double precision,double precision,double precision,double precision);
CREATE FUNCTION getbikingroute(_start_lat FLOAT, _start_lon FLOAT, _end_lat FLOAT, _end_lon FLOAT)
  RETURNS TABLE(seq          INT,
                id           VARCHAR,
                street       VARCHAR,
                directionality VARCHAR,
                feature_type VARCHAR,
                travel_time  FLOAT,
                distance     FLOAT,
                geom         GEOMETRY) AS
$func$
BEGIN
  RETURN QUERY
  SELECT
    min(r.seq)             AS seq,
    e.join_id              AS id,
    e.street,
    e.featuretyp           AS feature_type,
    e.one_way              AS directionality,
    sum(e.time_bike)       AS travel_time,
    sum(e.length_feet)     AS distance,
    ST_Collect(e.the_geom) AS geom
  FROM pgr_dijkstra(
           'SELECT id, source, target, cost_bike AS cost, rcost_bike as reverse_cost FROM edges where bikeable=TRUE',
           getnearestnode(_start_lat, _start_lon),
           getnearestnode(_end_lat, _end_lon),
           directed := TRUE) AS r,
    edges AS e
  WHERE r.edge = e.id
  GROUP BY e.join_id, e.street, e.featuretyp, e.one_way
  ORDER BY seq;
END
$func$ LANGUAGE plpgsql;


-- walking route
DROP FUNCTION IF EXISTS getwalkingroute(double precision,double precision,double precision,double precision);
CREATE FUNCTION getwalkingroute(_start_lat FLOAT, _start_lon FLOAT, _end_lat FLOAT, _end_lon FLOAT)
  RETURNS TABLE(seq          INT,
                id           VARCHAR,
                street       VARCHAR,
                directionality VARCHAR,
                feature_type VARCHAR,
                travel_time  FLOAT,
                distance     FLOAT,
                geom         GEOMETRY) AS
$func$
BEGIN
  RETURN QUERY
  SELECT
    min(r.seq)             AS seq,
    e.join_id              AS id,
    e.street,
    e.featuretyp           AS feature_type,
    e.one_way              AS directionality,
    sum(e.time_walk)       AS travel_time,
    sum(e.length_feet)     AS distance,
    ST_Collect(e.the_geom) AS geom
  FROM pgr_dijkstra('SELECT id, source, target, cost_walk AS cost FROM edges where walkable=TRUE',
                    getnearestnode(_start_lat, _start_lon),
                    getnearestnode(_end_lat, _end_lon),
                    directed := FALSE) AS r,
    edges AS e
  WHERE r.edge = e.id
  GROUP BY e.join_id, e.street, e.one_way, e.featuretyp
  ORDER BY seq;
END
$func$ LANGUAGE plpgsql;

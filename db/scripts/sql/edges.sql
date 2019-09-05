-------------------------------------------------------
-- Creates edges table and maps values from LION table
-------------------------------------------------------

DROP TABLE IF EXISTS public.edges;
DROP TABLE IF EXISTS public.edges_vertices_pgr;

SELECT
  MAX(objectid) as objectid,
  join_id,
  street,
  trafdir,
  nodelevelf,
  nodelevelt,
  posted_speed,
  number_travel_lanes,
  featuretyp,
  bikelane,
  bike_trafdir,
  nonped,
  segmenttyp,
  rw_type,
  st_linemerge(ST_Union(the_geom)) as the_geom
INTO public.edges
FROM lion
WHERE featuretyp IN ('0', 'A', '6', 'W', 'F') AND segmenttyp NOT IN ('G', 'F')
GROUP BY
  join_id,
  street,
  trafdir,
  nodelevelf,
  nodelevelt,
  posted_speed,
  number_travel_lanes,
  featuretyp,
  bikelane,
  bike_trafdir,
  nonped,
  segmenttyp,
  rw_type;

-- create indexes
CREATE UNIQUE INDEX IF NOT EXISTS edges_uniq_idx
  ON public.edges (objectid);
CREATE INDEX IF NOT EXISTS edges_join_id_idx
  ON public.edges (join_id);
CREATE INDEX IF NOT EXISTS edges_geom_idx
  ON public.edges USING GIST (the_geom);

-- fields to be populated
ALTER TABLE public.edges
  ADD COLUMN id SERIAL PRIMARY KEY,
  ADD COLUMN source INTEGER,
  ADD COLUMN target INTEGER,

  ADD COLUMN one_way VARCHAR(2),
  ADD COLUMN time_drive DOUBLE PRECISION,
  ADD COLUMN cost_drive DOUBLE PRECISION,
  ADD COLUMN rcost_drive DOUBLE PRECISION,

  ADD COLUMN one_way_bike VARCHAR(2),
  ADD COLUMN time_bike DOUBLE PRECISION,
  ADD COLUMN cost_bike DOUBLE PRECISION,
  ADD COLUMN rcost_bike DOUBLE PRECISION,

  ADD COLUMN time_walk DOUBLE PRECISION,
  ADD COLUMN cost_walk DOUBLE PRECISION,
  ADD COLUMN rcost_walk DOUBLE PRECISION,

  ADD COLUMN x1 DOUBLE PRECISION,
  ADD COLUMN y1 DOUBLE PRECISION,
  ADD COLUMN x2 DOUBLE PRECISION,
  ADD COLUMN y2 DOUBLE PRECISION,
  ADD COLUMN bikeable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN driveable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN walkable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN length_feet DOUBLE PRECISION;

CREATE INDEX lion_source_idx
  ON public.edges USING BTREE (source);
CREATE INDEX lion_target_idx
  ON public.edges USING BTREE (target);
CREATE INDEX lion_featuretyp_idx
  ON public.edges USING BTREE (featuretyp);

UPDATE public.edges
SET x1        = st_x(st_startpoint(the_geom)),
  y1          = st_y(st_startpoint(the_geom)),
  x2          = st_x(st_endpoint(the_geom)),
  y2          = st_y(st_endpoint(the_geom)),
  length_feet = ST_Length(ST_Transform(the_geom, 2263));
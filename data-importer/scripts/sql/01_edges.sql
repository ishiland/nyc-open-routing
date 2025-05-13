-------------------------------------------------------
-- Creates edges table and maps values from LION table
-------------------------------------------------------

DROP TABLE IF EXISTS public.edges;
DROP TABLE IF EXISTS public.edges_vertices_pgr;

SELECT
  join_id,
  street,
  trafdir,
  featuretyp,
  nonped,
  (ST_Dump(the_geom)).geom AS the_geom -- Explode MultiLineStrings into LineStrings
INTO public.edges
FROM lion
WHERE featuretyp IN ('0', 'A', '6', 'W', 'F');


-- create indexes
CREATE INDEX IF NOT EXISTS edges_join_id_idx
  ON public.edges (join_id);
CREATE INDEX IF NOT EXISTS edges_geom_idx
  ON public.edges USING GIST (the_geom);

-- fields to be populated
ALTER TABLE public.edges ADD COLUMN id SERIAL PRIMARY KEY;
ALTER TABLE public.edges ADD COLUMN source INTEGER;
ALTER TABLE public.edges ADD COLUMN target INTEGER;

ALTER TABLE public.edges ADD COLUMN time_drive DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN cost_drive DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN rcost_drive DOUBLE PRECISION;

ALTER TABLE public.edges ADD COLUMN time_bike DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN cost_bike DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN rcost_bike DOUBLE PRECISION;

ALTER TABLE public.edges ADD COLUMN time_walk DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN cost_walk DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN rcost_walk DOUBLE PRECISION;

ALTER TABLE public.edges ADD COLUMN x1 DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN y1 DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN x2 DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN y2 DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN bikeable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.edges ADD COLUMN driveable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.edges ADD COLUMN walkable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.edges ADD COLUMN length_feet DOUBLE PRECISION;
ALTER TABLE public.edges ADD COLUMN the_geom_4326 GEOMETRY(LineString, 4326);

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
  length_feet = ST_Length(ST_Transform(the_geom, 2263)),
  the_geom_4326 = ST_Transform(the_geom, 4326);

CREATE INDEX IF NOT EXISTS edges_the_geom_4326_idx
  ON public.edges USING GIST (the_geom_4326);
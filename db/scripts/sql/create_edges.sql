DROP TABLE IF EXISTS public.edges;
DROP TABLE IF EXISTS public.edges_vertices_pgr;

-- SELECT
--   join_id,
--   street,
--   trafdir,
--   nodelevelf,
--   nodelevelt,
--   posted_speed,
--   number_travel_lanes,
--   featuretyp,
--   bikelane,
--   bike_trafdir,
--   nonped,
--   segmenttyp,
--   the_geom
-- INTO public.edges
-- FROM lion
-- WHERE featuretyp IN ('0', 'A', 'W', 'F') AND segmenttyp NOT IN ('G', 'F');

SELECT * INTO public.edges FROM lion;

-- create indexes
CREATE UNIQUE INDEX IF NOT EXISTS edges_uniq_idx on public.edges(objectid);
CREATE INDEX IF NOT EXISTS edges_join_id_idx on public.edges(join_id);
CREATE INDEX IF NOT EXISTS edges_geom_idx ON public.edges USING GIST (the_geom);

-- fields to be populated
ALTER TABLE public.edges
  ADD COLUMN id SERIAL PRIMARY KEY,
  ADD COLUMN source INTEGER,
  ADD COLUMN target INTEGER,
  ADD COLUMN one_way VARCHAR(2),
--   ADD COLUMN speed_mph INTEGER,
--   ADD COLUMN cost_len DOUBLE PRECISION,
--   ADD COLUMN rcost_len DOUBLE PRECISION,
  ADD COLUMN time_drive DOUBLE PRECISION,
--ADD COLUMN rcost_time DOUBLE PRECISION,
  ADD COLUMN cost_drive DOUBLE PRECISION,
  ADD COLUMN rcost_drive DOUBLE PRECISION,

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
--ADD COLUMN to_cost DOUBLE PRECISION,
--ADD COLUMN rule TEXT,
--ADD COLUMN isolated INTEGER;

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

-- convert `posted_speed` to numeric
UPDATE public.edges
SET posted_speed = '25'
WHERE TRIM(posted_speed) = '';
ALTER TABLE public.edges

  ALTER COLUMN posted_speed TYPE NUMERIC(3, 0) USING posted_speed :: NUMERIC;

-- convert `number_travel_lanes` to numeric
UPDATE public.edges
SET number_travel_lanes = '1'
WHERE TRIM(number_travel_lanes) = '';
ALTER TABLE public.edges
  ALTER COLUMN number_travel_lanes TYPE NUMERIC(2, 0) USING number_travel_lanes :: NUMERIC;

--
UPDATE public.edges
SET one_way = 'B'
WHERE trafdir = UPPER(TRIM(('T')));
UPDATE public.edges
SET one_way = 'TF'
WHERE trafdir = UPPER(TRIM(('A')));
UPDATE public.edges
SET one_way = 'FT'
WHERE trafdir = UPPER(TRIM(('W')));

-- update columns for easier queries of different transportation modes
UPDATE public.edges
SET driveable = TRUE
WHERE featuretyp = '0' AND trafdir IN ('A', 'W', 'T');

UPDATE public.edges
SET walkable = TRUE,
  bikeable   = TRUE
WHERE nonped <> 'V';

-- calculate travel times in different modes for each segment.
UPDATE public.edges
SET time_drive = (length_feet :: NUMERIC / 5280) / (posted_speed :: NUMERIC / 60),
  time_bike    = (length_feet :: NUMERIC / 5280) / .2, --(12/60), based on AVG 12mph bike speed
  time_walk    = (length_feet :: NUMERIC / 5280) / .05; --(3/60) based on AVG 3mph walk speed

-- For Ferry routes
UPDATE public.edges
SET time_bike = (length_feet :: NUMERIC / 5280) / .42, --(25/60), based on AVG 25mph Ferry speed
  time_walk   = (length_feet :: NUMERIC / 5280) / .42
WHERE featuretyp = 'F';

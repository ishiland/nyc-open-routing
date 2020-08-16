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

-- map new values for driving directionality
UPDATE public.edges
SET one_way = 'B'
WHERE trafdir = UPPER(TRIM(('T')));
UPDATE public.edges
SET one_way = 'TF'
WHERE trafdir = UPPER(TRIM(('A')));
UPDATE public.edges
SET one_way = 'FT'
WHERE trafdir = UPPER(TRIM(('W')));

-- map new values for biking directionality
UPDATE public.edges
SET one_way_bike = 'B'
WHERE bike_trafdir = UPPER(TRIM(('TW')));
UPDATE public.edges
SET one_way_bike = 'TF'
WHERE bike_trafdir = UPPER(TRIM(('TF')));
UPDATE public.edges
SET one_way_bike = 'FT'
WHERE bike_trafdir = UPPER(TRIM(('FT')));
UPDATE public.edges
-- follow car direction if not specified
SET one_way_bike = one_way
WHERE bike_trafdir IS NULL OR TRIM(bike_trafdir) = '';

-- add route restrictions for different travel modes
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

---------------------------------------------
--              driving cost
---------------------------------------------
--  BOTH direction
UPDATE edges
SET cost_drive = time_drive,
  rcost_drive  = time_drive
WHERE one_way = 'B';
-- WITH traffic direction
UPDATE edges
SET cost_drive = time_drive,
  rcost_drive  = time_drive * 100
WHERE one_way = 'FT';
-- AGAINST traffic direction
UPDATE edges
SET cost_drive = time_drive * 100,
  rcost_drive  = time_drive
WHERE one_way = 'TF';

UPDATE edges
SET cost_drive = time_drive
WHERE cost_drive is NULL and driveable=TRUE;

----------------------------------------------
--              biking costs
----------------------------------------------
--  BOTH direction
UPDATE edges
SET rcost_bike = time_drive,
  cost_bike    = time_drive
WHERE one_way_bike = 'B';
-- WITH traffic direction
UPDATE edges
SET rcost_bike = time_bike * 100,
  cost_bike    = time_bike
WHERE one_way_bike = 'FT';
-- AGAINST traffic direction
UPDATE edges
SET cost_bike = time_bike * 100,
  rcost_bike  = time_bike
WHERE one_way_bike = 'TF';
-- update any null values
UPDATE edges
SET cost_bike = time_bike,
  rcost_bike  = time_bike
WHERE cost_bike IS NULL AND bikeable = TRUE;
-- set BIKE cost for pedestrian path
UPDATE edges
SET cost_bike = time_bike,
  rcost_bike  = time_bike
WHERE trafdir = 'P';

-- prioritize biking directionality vs driving directionality
UPDATE edges
SET cost_bike = cost_bike * 10,
  rcost_bike  = rcost_bike * 10
WHERE bike_trafdir IS NULL OR TRIM(bike_trafdir) = '';

-- increased cost for bike lanes with stairs and empty values.
UPDATE edges
SET cost_bike = (
  SELECT CASE
         WHEN TRIM(bikelane) = '' -- not designated bike lane
           THEN cost_bike * 10
         WHEN bikelane is NULL -- not designated bike lane
           THEN cost_bike * 10
         WHEN TRIM(bikelane) = '7' -- Stairs: Includes step streets, bridge stairs, etc.
           THEN cost_bike * 100
         ELSE cost_bike
         END
);

----------------------------------------------
--              walking costs
----------------------------------------------
UPDATE edges
SET cost_walk = time_walk;

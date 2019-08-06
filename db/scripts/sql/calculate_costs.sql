
   -- driving cost in BOTH directions
    UPDATE edges
      SET cost_drive = time_drive,
          rcost_drive = time_drive
      WHERE trafdir IN ('T');

   -- driving cost WITH traffic directions
    UPDATE edges
      SET cost_drive = time_drive,
          rcost_drive = time_drive * 100
      WHERE trafdir IN ('W');

    -- driving cost AGAINST traffic directions
        UPDATE edges
      SET cost_drive = time_drive * 100,
          rcost_drive = time_drive
      WHERE trafdir IN ('A');

-- set BIKE cost with traffic
UPDATE edges
SET rcost_bike  = time_bike * 100,
  cost_bike = time_bike
WHERE bike_trafdir = 'FT';

-- set BIKE cost against traffic
UPDATE edges
SET cost_bike = time_bike * 100,
  rcost_bike = time_bike
WHERE bike_trafdir = 'TF';

  -- set BIKE cost two way or pedstrian
UPDATE edges
SET cost_bike = time_bike,
  rcost_bike = time_bike
WHERE cost_bike is null and bikeable=TRUE;

-- set BIKE cost pedestrian path
UPDATE edges
SET cost_bike = time_bike,
  rcost_bike = time_bike
WHERE bike_trafdir = 'P';

-- set BIKE cost empty values
UPDATE edges
SET cost_bike = time_bike * 10,
  rcost_bike = time_bike * 10
WHERE bike_trafdir is NULL or TRIM(bike_trafdir) = '';

-- update BIKE cost with pedestrian and vehicle accessible restrictions
UPDATE edges
SET cost_bike = (
  SELECT CASE
         WHEN nonped = 'V' -- vehicle only
           THEN cost_bike * 100
         WHEN nonped = 'D' -- DOE exclusion for pupils
           THEN cost_bike * 10
         END
);

-- bike lanes
UPDATE edges
SET cost_bike = (
  SELECT CASE
         WHEN TRIM(bikelane) NOT IN ('', '7')
           THEN cost_bike
         ELSE time_bike * 10
         END
);

-- add extra cost for non-bike lane streets
  UPDATE edges
SET rcost_bike  = time_bike * 2,
  cost_bike = time_bike * 2
where bikeable=TRUE and cost_bike is null;

-- pedestrian lanes
UPDATE edges
SET
cost_bike = time_bike,
rcost_bike  = time_bike
where trafdir = 'P' and cost_bike is null;

-- update WALK cost with pedestrian and vehicle accessible restrictions
UPDATE edges
SET cost_walk = (
  SELECT CASE
         WHEN nonped = 'V' -- vehicle only
           THEN time_walk * 100
         WHEN nonped = 'D' -- DOE exclusion for pupils
           THEN time_walk * 10
          ELSE time_walk
         END
);

update edges set cost_walk = time_walk WHERE cost_walk is null and walkable=TRUE;
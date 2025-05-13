-- add route restrictions for different travel modes
UPDATE public.edges
SET driveable = TRUE
WHERE featuretyp = '0' AND trafdir IN ('A', 'W', 'T');

UPDATE public.edges
SET walkable = TRUE,
  bikeable   = TRUE
WHERE nonped <> 'V';

-- calculate travel times in different modes for each segment.
-- Speed placeholders like {drive_speed_mph} will be replaced by the Python script.
UPDATE public.edges
SET time_drive = (length_feet :: NUMERIC / 5280) / ({drive_speed_mph} :: NUMERIC / 60.0),
  time_bike    = (length_feet :: NUMERIC / 5280) / ({bike_speed_mph} :: NUMERIC / 60.0),
  time_walk    = (length_feet :: NUMERIC / 5280) / ({walk_speed_mph} :: NUMERIC / 60.0);

-- For Ferry routes
-- Note: Ferry speed placeholder {ferry_speed_mph}
UPDATE public.edges
SET time_bike = (length_feet :: NUMERIC / 5280) / ({ferry_speed_mph} :: NUMERIC / 60.0), -- Using ferry speed for biking on ferry
  time_walk   = (length_feet :: NUMERIC / 5280) / ({ferry_speed_mph} :: NUMERIC / 60.0)  -- Using ferry speed for walking on ferry
WHERE featuretyp = 'F'; 
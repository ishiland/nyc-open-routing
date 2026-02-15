-------------------------------------------------------
-- Calculate travel times and set route restrictions
-- ROBUST VERSION: Type-safe string to numeric conversion with validation
-------------------------------------------------------

---------------------------------------------
-- Step 1: Clean and validate posted_speed (string -> numeric)
---------------------------------------------
-- First ensure it's treated as string and clean it
UPDATE public.edges
SET posted_speed = CASE
    WHEN posted_speed IS NULL THEN '25'
    WHEN posted_speed::TEXT = '' OR TRIM(posted_speed::TEXT) = '' THEN '25'
    WHEN posted_speed::TEXT ~ '^[0-9]+$' THEN posted_speed::TEXT  -- Valid numeric string
    ELSE '25'  -- Invalid values default to 25 mph
END;

-- Convert to numeric type
ALTER TABLE public.edges
  ALTER COLUMN posted_speed TYPE NUMERIC(3, 0) USING posted_speed::NUMERIC;

-- Add constraint for valid speed range
ALTER TABLE public.edges
  ADD CONSTRAINT chk_posted_speed CHECK (posted_speed >= 5 AND posted_speed <= 70);

-- Log conversion statistics
DO $$
DECLARE
    min_speed NUMERIC;
    max_speed NUMERIC;
    avg_speed NUMERIC;
    default_count INTEGER;
BEGIN
    SELECT MIN(posted_speed), MAX(posted_speed), AVG(posted_speed)
    INTO min_speed, max_speed, avg_speed
    FROM public.edges;

    SELECT COUNT(*) INTO default_count FROM public.edges WHERE posted_speed = 25;

    RAISE NOTICE 'posted_speed conversion: min=%, max=%, avg=%, defaulted to 25: %',
                 min_speed, max_speed, ROUND(avg_speed, 1), default_count;
END $$;

---------------------------------------------
-- Step 2: Clean and validate number_travel_lanes (string -> numeric)
---------------------------------------------
-- First ensure it's treated as string and clean it
UPDATE public.edges
SET number_travel_lanes = CASE
    WHEN number_travel_lanes IS NULL THEN '1'
    WHEN number_travel_lanes::TEXT = '' OR TRIM(number_travel_lanes::TEXT) = '' THEN '1'
    WHEN number_travel_lanes::TEXT ~ '^[0-9]+$' THEN number_travel_lanes::TEXT  -- Valid numeric string
    ELSE '1'  -- Invalid values default to 1 lane
END;

-- Convert to numeric type
ALTER TABLE public.edges
  ALTER COLUMN number_travel_lanes TYPE NUMERIC(2, 0) USING number_travel_lanes::NUMERIC;

-- Add constraint for valid lane count
ALTER TABLE public.edges
  ADD CONSTRAINT chk_number_travel_lanes CHECK (number_travel_lanes >= 1 AND number_travel_lanes <= 12);

-- Log conversion statistics
DO $$
DECLARE
    min_lanes NUMERIC;
    max_lanes NUMERIC;
    avg_lanes NUMERIC;
    default_count INTEGER;
BEGIN
    SELECT MIN(number_travel_lanes), MAX(number_travel_lanes), AVG(number_travel_lanes)
    INTO min_lanes, max_lanes, avg_lanes
    FROM public.edges;

    SELECT COUNT(*) INTO default_count FROM public.edges WHERE number_travel_lanes = 1;

    RAISE NOTICE 'number_travel_lanes conversion: min=%, max=%, avg=%, defaulted to 1: %',
                 min_lanes, max_lanes, ROUND(avg_lanes, 1), default_count;
END $$;

---------------------------------------------
-- Step 3: Map driving directionality (trafdir -> one_way)
-- trafdir codes: T=Two-way, A=With digitized direction, W=Against digitized direction
---------------------------------------------
UPDATE public.edges
SET one_way = CASE
    WHEN UPPER(TRIM(trafdir)) = 'T' THEN 'B'   -- Both directions
    WHEN UPPER(TRIM(trafdir)) = 'A' THEN 'TF'  -- To->From only
    WHEN UPPER(TRIM(trafdir)) = 'W' THEN 'FT'  -- From->To only
    ELSE 'B'  -- Default to both if unknown
END;

-- Log trafdir mapping
DO $$
DECLARE
    two_way_count INTEGER;
    with_count INTEGER;
    against_count INTEGER;
    unknown_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO two_way_count FROM public.edges WHERE one_way = 'B';
    SELECT COUNT(*) INTO with_count FROM public.edges WHERE one_way = 'TF';
    SELECT COUNT(*) INTO against_count FROM public.edges WHERE one_way = 'FT';
    SELECT COUNT(*) INTO unknown_count FROM public.edges
    WHERE trafdir NOT IN ('T', 'A', 'W') OR trafdir IS NULL;

    RAISE NOTICE 'Driving directionality: Two-way=%, With=%, Against=%, Unknown=%',
                 two_way_count, with_count, against_count, unknown_count;
END $$;

---------------------------------------------
-- Step 4: Map biking directionality (bike_trafdir -> one_way_bike)
-- bike_trafdir codes: TW=Two-way, TF=To->From, FT=From->To
---------------------------------------------
UPDATE public.edges
SET one_way_bike = CASE
    WHEN UPPER(TRIM(bike_trafdir)) = 'TW' THEN 'B'   -- Both directions
    WHEN UPPER(TRIM(bike_trafdir)) = 'TF' THEN 'TF'  -- To->From only
    WHEN UPPER(TRIM(bike_trafdir)) = 'FT' THEN 'FT'  -- From->To only
    WHEN bike_trafdir IS NULL OR TRIM(bike_trafdir) = '' THEN one_way  -- Follow car direction
    ELSE one_way  -- Default to car direction if unknown
END;

---------------------------------------------
-- Step 5: Set route restrictions for different travel modes
---------------------------------------------
-- Driveable: Only FeatureTyp='0' (Street) with traffic direction
UPDATE public.edges
SET driveable = (featuretyp = '0' AND trafdir IN ('A', 'W', 'T'));

-- Walkable: Anywhere except NonPed='V' (vehicle-only)
UPDATE public.edges
SET walkable = (nonped IS NULL OR nonped <> 'V');

-- Bikeable: More restrictive than walking
-- FeatureTyp='W' (non-vehicular paths) require explicit bike lane designation
-- All other features: bikeable unless NonPed='V'
UPDATE public.edges
SET bikeable = CASE
    WHEN featuretyp = 'W' THEN (bikelane IS NOT NULL AND TRIM(bikelane) != '')
    ELSE (nonped IS NULL OR nonped <> 'V')
END;

-- Log mode restrictions
DO $$
DECLARE
    driveable_count INTEGER;
    bikeable_count INTEGER;
    walkable_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO driveable_count FROM public.edges WHERE driveable = TRUE;
    SELECT COUNT(*) INTO bikeable_count FROM public.edges WHERE bikeable = TRUE;
    SELECT COUNT(*) INTO walkable_count FROM public.edges WHERE walkable = TRUE;

    RAISE NOTICE 'Mode restrictions: Driveable=%, Bikeable=%, Walkable=%',
                 driveable_count, bikeable_count, walkable_count;
END $$;

---------------------------------------------
-- Step 6: Calculate travel times for each mode
-- Drive: Based on posted_speed and length, adjusted by lane count
--   - Highways (4+ lanes): 95% of posted speed (smoother flow)
--   - Local streets (1-2 lanes): 80% of posted speed (more stops, turns)
--   - Medium roads (3 lanes): 87.5% average
-- Bike: Assumes 12 mph average speed
-- Walk: Assumes 3 mph average speed
---------------------------------------------
UPDATE public.edges
SET time_drive = CASE
        WHEN number_travel_lanes >= 4 THEN (length_feet / 5280.0) / ((posted_speed * 0.95) / 60.0)
        WHEN number_travel_lanes <= 2 THEN (length_feet / 5280.0) / ((posted_speed * 0.80) / 60.0)
        ELSE (length_feet / 5280.0) / ((posted_speed * 0.875) / 60.0)
    END,
    time_bike  = (length_feet / 5280.0) / 0.2,   -- 12 mph = 0.2 miles/minute
    time_walk  = (length_feet / 5280.0) / 0.05;  -- 3 mph = 0.05 miles/minute

---------------------------------------------
-- Step 7: Special handling for Ferry routes (FeatureTyp='F')
-- Ferries carry vehicles, bikes, and pedestrians at ~25 mph
-- Per LION metadata: "Ferry routes required for bicycle routing within NYC"
-- Add waiting time penalty (15 min average) to discourage unless necessary
---------------------------------------------
UPDATE public.edges
SET time_bike = ((length_feet / 5280.0) / 0.42) + (15.0 / 60.0),  -- Transit time + 15 min wait
    time_walk = ((length_feet / 5280.0) / 0.42) + (15.0 / 60.0),  -- Transit time + 15 min wait
    bikeable  = TRUE,   -- Bikes allowed on ferries (per LION metadata)
    driveable = FALSE,  -- Private vehicles not included in routing (use transit mode)
    walkable  = TRUE    -- Pedestrians can walk on/off
WHERE featuretyp = 'F';

-- Log ferry routes
DO $$
DECLARE
    ferry_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO ferry_count FROM public.edges WHERE featuretyp = 'F';
    IF ferry_count > 0 THEN
        RAISE NOTICE 'Processed % ferry routes with special timing', ferry_count;
    END IF;
END $$;

---------------------------------------------
-- Step 8: Validation - check for invalid travel times
---------------------------------------------
DO $$
DECLARE
    null_time_drive INTEGER;
    null_time_bike INTEGER;
    null_time_walk INTEGER;
    negative_time INTEGER;
    zero_time INTEGER;
BEGIN
    -- Check for NULL times on routes that should have them
    SELECT COUNT(*) INTO null_time_drive FROM public.edges
    WHERE driveable = TRUE AND time_drive IS NULL;

    SELECT COUNT(*) INTO null_time_bike FROM public.edges
    WHERE bikeable = TRUE AND time_bike IS NULL;

    SELECT COUNT(*) INTO null_time_walk FROM public.edges
    WHERE walkable = TRUE AND time_walk IS NULL;

    IF null_time_drive > 0 OR null_time_bike > 0 OR null_time_walk > 0 THEN
        RAISE WARNING 'NULL travel times found: drive=%, bike=%, walk=%',
                      null_time_drive, null_time_bike, null_time_walk;
    END IF;

    -- Check for negative or zero times
    SELECT COUNT(*) INTO negative_time FROM public.edges
    WHERE time_drive < 0 OR time_bike < 0 OR time_walk < 0;

    SELECT COUNT(*) INTO zero_time FROM public.edges
    WHERE time_drive = 0 OR time_bike = 0 OR time_walk = 0;

    IF negative_time > 0 THEN
        RAISE WARNING 'Found % edges with negative travel times', negative_time;
    END IF;

    IF zero_time > 0 THEN
        RAISE WARNING 'Found % edges with zero travel times', zero_time;
    END IF;

    RAISE NOTICE '=== 02_travel_time.sql completed successfully ===';
END $$;

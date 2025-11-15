---------------------------------------------
--           IMPROVED COST CALCULATIONS
---------------------------------------------
-- This is an improved version of 03_cost.sql that fixes
-- compounding penalty issues and adds more realistic costs

---------------------------------------------
--          PRE-FLIGHT VALIDATION
---------------------------------------------
-- Ensure all prerequisites are met before calculating costs
DO $$
DECLARE
    edges_count INTEGER;
    missing_time_drive INTEGER;
    missing_time_bike INTEGER;
    missing_time_walk INTEGER;
    missing_one_way INTEGER;
    missing_one_way_bike INTEGER;
    missing_length INTEGER;
    missing_speed INTEGER;
BEGIN
    -- Check if edges table exists and has data
    SELECT COUNT(*) INTO edges_count FROM public.edges;
    IF edges_count = 0 THEN
        RAISE EXCEPTION 'Cannot calculate costs: edges table is empty';
    END IF;

    -- Check for missing travel times (required for cost calculation)
    SELECT COUNT(*) INTO missing_time_drive FROM public.edges
    WHERE driveable = TRUE AND time_drive IS NULL;

    SELECT COUNT(*) INTO missing_time_bike FROM public.edges
    WHERE bikeable = TRUE AND time_bike IS NULL;

    SELECT COUNT(*) INTO missing_time_walk FROM public.edges
    WHERE walkable = TRUE AND time_walk IS NULL;

    IF missing_time_drive > 0 THEN
        RAISE EXCEPTION 'Cannot calculate costs: % driveable edges missing time_drive', missing_time_drive;
    END IF;

    IF missing_time_bike > 0 THEN
        RAISE EXCEPTION 'Cannot calculate costs: % bikeable edges missing time_bike', missing_time_bike;
    END IF;

    IF missing_time_walk > 0 THEN
        RAISE EXCEPTION 'Cannot calculate costs: % walkable edges missing time_walk', missing_time_walk;
    END IF;

    -- Check for missing directionality fields
    SELECT COUNT(*) INTO missing_one_way FROM public.edges
    WHERE driveable = TRUE AND one_way IS NULL;

    SELECT COUNT(*) INTO missing_one_way_bike FROM public.edges
    WHERE bikeable = TRUE AND one_way_bike IS NULL;

    IF missing_one_way > 0 THEN
        RAISE WARNING 'Found % driveable edges with NULL one_way field', missing_one_way;
    END IF;

    IF missing_one_way_bike > 0 THEN
        RAISE WARNING 'Found % bikeable edges with NULL one_way_bike field', missing_one_way_bike;
    END IF;

    -- Check for missing base fields
    SELECT COUNT(*) INTO missing_length FROM public.edges WHERE length_feet IS NULL OR length_feet <= 0;
    SELECT COUNT(*) INTO missing_speed FROM public.edges WHERE driveable = TRUE AND (posted_speed IS NULL OR posted_speed <= 0);

    IF missing_length > 0 THEN
        RAISE WARNING 'Found % edges with invalid length_feet', missing_length;
    END IF;

    IF missing_speed > 0 THEN
        RAISE WARNING 'Found % driveable edges with invalid posted_speed', missing_speed;
    END IF;

    RAISE NOTICE 'Pre-flight validation passed: % edges ready for cost calculation', edges_count;
END $$;

---------------------------------------------
--              Driving Cost
---------------------------------------------
-- Both directions (bidirectional)
UPDATE edges
SET cost_drive = time_drive,
    rcost_drive = time_drive
WHERE one_way = 'B' AND driveable = TRUE;

-- One-way: with traffic direction (from->to allowed)
UPDATE edges
SET cost_drive = time_drive,
    rcost_drive = time_drive * 100  -- Block reverse direction
WHERE one_way = 'FT' AND driveable = TRUE;

-- One-way: against traffic direction (to->from allowed)
UPDATE edges
SET cost_drive = time_drive * 100,  -- Block forward direction
    rcost_drive = time_drive
WHERE one_way = 'TF' AND driveable = TRUE;

-- Handle any remaining null costs for driveable edges
UPDATE edges
SET cost_drive = time_drive,
    rcost_drive = time_drive
WHERE cost_drive IS NULL AND driveable = TRUE;

-- NOTE: Realism factors removed due to inverted logic
-- (multiplying by 0.70 makes routes faster, not slower)
-- Consider re-adding with correct logic: multiply by 1.15, 1.25, 1.40 if needed

----------------------------------------------
--              Biking Costs (FIXED)
----------------------------------------------
-- Single comprehensive UPDATE to avoid compounding penalties
UPDATE edges
SET
    cost_bike = CASE
        -- CASE 1: Stairs (bikelane = '7')
        -- Difficult but not impossible for cyclists
        WHEN TRIM(bikelane) = '7' THEN time_bike * 50

        -- CASE 2: One-way against bike direction (to->from)
        WHEN one_way_bike = 'TF' THEN
            CASE
                -- Has designated bike lane against traffic: moderate penalty
                WHEN bikelane IS NOT NULL AND TRIM(bikelane) != '' AND TRIM(bikelane) != '7'
                    THEN time_bike * 10
                -- No bike lane against traffic: effectively blocked
                ELSE time_bike * 100
            END

        -- CASE 3: One-way with bike direction (from->to)
        WHEN one_way_bike = 'FT' THEN
            CASE
                -- Has designated bike lane: preferred
                WHEN bikelane IS NOT NULL AND TRIM(bikelane) != '' AND TRIM(bikelane) != '7'
                    THEN time_bike * 1.0
                -- No bike lane but with traffic: moderate penalty
                ELSE time_bike * 5.0
            END

        -- CASE 4: Bidirectional
        WHEN one_way_bike = 'B' THEN
            CASE
                -- Has designated bike lane: preferred
                WHEN bikelane IS NOT NULL AND TRIM(bikelane) != '' AND TRIM(bikelane) != '7'
                    THEN time_bike * 1.0
                -- No bike lane: slight penalty
                ELSE time_bike * 3.0
            END

        -- CASE 5: Default (shouldn't happen but handle gracefully)
        ELSE time_bike * 3.0
    END,

    rcost_bike = CASE
        -- CASE 1: Stairs
        WHEN TRIM(bikelane) = '7' THEN time_bike * 50

        -- CASE 2: One-way with bike direction (reverse is against)
        WHEN one_way_bike = 'FT' THEN
            CASE
                WHEN bikelane IS NOT NULL AND TRIM(bikelane) != '' AND TRIM(bikelane) != '7'
                    THEN time_bike * 10
                ELSE time_bike * 100
            END

        -- CASE 3: One-way against bike direction (reverse is with)
        WHEN one_way_bike = 'TF' THEN
            CASE
                WHEN bikelane IS NOT NULL AND TRIM(bikelane) != '' AND TRIM(bikelane) != '7'
                    THEN time_bike * 1.0
                ELSE time_bike * 5.0
            END

        -- CASE 4: Bidirectional
        WHEN one_way_bike = 'B' THEN
            CASE
                WHEN bikelane IS NOT NULL AND TRIM(bikelane) != '' AND TRIM(bikelane) != '7'
                    THEN time_bike * 1.0
                ELSE time_bike * 3.0
            END

        -- CASE 5: Default
        ELSE time_bike * 3.0
    END
WHERE bikeable = TRUE;

-- Additional penalty for roads without bike infrastructure
-- (This replaces the previous problematic sequential updates)
-- Already handled in the comprehensive CASE statement above

-- Set cost for pedestrian-only paths (can walk bikes)
UPDATE edges
SET cost_bike = time_bike * 2.0,  -- Can walk bike but slower
    rcost_bike = time_bike * 2.0
WHERE trafdir = 'P' AND bikeable = TRUE;

----------------------------------------------
--              Walking Costs (IMPROVED)
----------------------------------------------
-- Comprehensive walking cost calculation with appropriate penalties
UPDATE edges
SET cost_walk = CASE
    -- CASE 1: Non-pedestrian zones (highways, limited access)
    WHEN nonped = 'V' THEN time_walk * 100  -- Effectively blocked

    -- CASE 2: Major highways (even if pedestrian allowed, dangerous)
    WHEN featuretyp IN ('1', '2') THEN time_walk * 50  -- Strong discouragement

    -- CASE 3: Stairs (slower but walkable)
    WHEN TRIM(bikelane) = '7' THEN time_walk * 1.5  -- 50% longer

    -- CASE 4: Arterial roads (less pleasant, some penalty)
    WHEN posted_speed >= 40 THEN time_walk * 1.2  -- 20% penalty

    -- CASE 5: Normal pedestrian areas
    ELSE time_walk * 1.0
END,
    rcost_walk = CASE
    WHEN nonped = 'V' THEN time_walk * 100
    WHEN featuretyp IN ('1', '2') THEN time_walk * 50
    WHEN TRIM(bikelane) = '7' THEN time_walk * 1.5
    WHEN posted_speed >= 40 THEN time_walk * 1.2
    ELSE time_walk * 1.0
END
WHERE walkable = TRUE;

----------------------------------------------
--       Pedestrian-Only Paths (TrafDir='P')
----------------------------------------------
-- Handle pedestrian-only paths separately (sidewalks, plazas, etc.)
-- These are walk-only; bikes must be walked
UPDATE edges
SET walkable = TRUE,
    cost_walk = time_walk * 1.0,      -- Normal walking speed
    rcost_walk = time_walk * 1.0,
    bikeable = TRUE,                   -- Can walk bikes
    cost_bike = time_bike * 2.5,      -- Must walk bike (slower)
    rcost_bike = time_bike * 2.5,
    driveable = FALSE                  -- No vehicles
WHERE trafdir = 'P';

----------------------------------------------
--      RW_Type Cost Adjustments
----------------------------------------------
-- Apply additional cost factors based on roadway type for more realism
-- These adjustments account for special infrastructure like tunnels, ramps, stairs

-- Tunnels (RW_Type = '1'): slightly longer/less pleasant
UPDATE edges
SET cost_walk = cost_walk * 1.1,
    rcost_walk = rcost_walk * 1.1
WHERE rw_type = '1' AND walkable = TRUE;

-- Ramps (RW_Type = '2'): harder for pedestrians/bikes
UPDATE edges
SET cost_walk = cost_walk * 1.3,    -- 30% harder to walk ramps
    rcost_walk = rcost_walk * 1.3,
    cost_bike = cost_bike * 1.2,    -- 20% harder to bike ramps
    rcost_bike = rcost_bike * 1.2
WHERE rw_type = '2' AND (walkable = TRUE OR bikeable = TRUE);

-- Step streets (RW_Type = '3' or bikelane = '7'): very difficult
-- Already handled by bikelane='7' logic above, but ensure consistency
UPDATE edges
SET cost_walk = GREATEST(cost_walk, time_walk * 1.5),
    rcost_walk = GREATEST(rcost_walk, time_walk * 1.5)
WHERE rw_type = '3' AND walkable = TRUE;

----------------------------------------------
--       Ferry Accessibility Fix (FINAL)
----------------------------------------------
-- IMPORTANT: This MUST run AFTER all other cost calculations
-- Ferries should only be accessible from ferry terminals, not bridges/tunnels
-- Apply massive penalty to ferry edges to prevent direct bridge->ferry routing
-- This penalty ensures ferries are only used when routing through legitimate
-- ferry terminal streets, not when spatial topology creates invalid connections
-- (e.g., bridge overlapping ferry route in schematic representation)
UPDATE edges
SET cost_walk = time_walk * 1000,
    rcost_walk = time_walk * 1000,
    cost_bike = time_bike * 1000,
    rcost_bike = time_bike * 1000
WHERE featuretyp = 'F';

----------------------------------------------
--              Validation Checks
----------------------------------------------
-- Check for any edges with NULL or invalid costs
DO $$
DECLARE
    null_drive_count INTEGER;
    null_bike_count INTEGER;
    null_walk_count INTEGER;
    invalid_drive_count INTEGER;
    invalid_bike_count INTEGER;
    invalid_walk_count INTEGER;
BEGIN
    -- Count NULL costs
    SELECT COUNT(*) INTO null_drive_count FROM edges WHERE driveable = TRUE AND (cost_drive IS NULL OR rcost_drive IS NULL);
    SELECT COUNT(*) INTO null_bike_count FROM edges WHERE bikeable = TRUE AND (cost_bike IS NULL OR rcost_bike IS NULL);
    SELECT COUNT(*) INTO null_walk_count FROM edges WHERE walkable = TRUE AND cost_walk IS NULL;

    -- Count invalid costs (negative or zero)
    SELECT COUNT(*) INTO invalid_drive_count FROM edges WHERE driveable = TRUE AND (cost_drive <= 0 OR rcost_drive <= 0);
    SELECT COUNT(*) INTO invalid_bike_count FROM edges WHERE bikeable = TRUE AND (cost_bike <= 0 OR rcost_bike <= 0);
    SELECT COUNT(*) INTO invalid_walk_count FROM edges WHERE walkable = TRUE AND cost_walk <= 0;

    -- Report issues
    IF null_drive_count > 0 THEN
        RAISE WARNING 'Found % driveable edges with NULL costs', null_drive_count;
    END IF;
    IF null_bike_count > 0 THEN
        RAISE WARNING 'Found % bikeable edges with NULL costs', null_bike_count;
    END IF;
    IF null_walk_count > 0 THEN
        RAISE WARNING 'Found % walkable edges with NULL costs', null_walk_count;
    END IF;

    IF invalid_drive_count > 0 THEN
        RAISE WARNING 'Found % driveable edges with invalid (<=0) costs', invalid_drive_count;
    END IF;
    IF invalid_bike_count > 0 THEN
        RAISE WARNING 'Found % bikeable edges with invalid (<=0) costs', invalid_bike_count;
    END IF;
    IF invalid_walk_count > 0 THEN
        RAISE WARNING 'Found % walkable edges with invalid (<=0) costs', invalid_walk_count;
    END IF;

    -- Log success if no issues
    IF null_drive_count = 0 AND null_bike_count = 0 AND null_walk_count = 0 AND
       invalid_drive_count = 0 AND invalid_bike_count = 0 AND invalid_walk_count = 0 THEN
        RAISE NOTICE 'Cost calculation validation passed: All costs are valid';
    END IF;
END $$;

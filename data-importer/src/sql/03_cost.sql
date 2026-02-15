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
--              Biking Costs (ENHANCED)
----------------------------------------------
-- Single comprehensive UPDATE to avoid compounding penalties
-- Now differentiates bike lane classes:
--   Class 1 (Separated Greenway): 0.8x multiplier (preferred)
--   Class 2 (Striped Lane): 1.0x multiplier (baseline)
--   Class 3 (Signed Route): 1.5x multiplier (shared road with signage only)
--   Class 7 (Stairs): 50x multiplier (walk bike)
UPDATE edges
SET
    cost_bike = CASE
        -- CASE 1: Stairs (bikelane = '7')
        -- Difficult but not impossible for cyclists
        WHEN TRIM(bikelane) = '7' THEN time_bike * 50

        -- CASE 2: One-way against bike direction (to->from)
        WHEN one_way_bike = 'TF' THEN
            CASE
                -- Class 1: Separated greenway against traffic
                WHEN TRIM(bikelane) IN ('1', '10', '11') THEN time_bike * 8   -- 0.8 * 10
                -- Class 2: Striped lane against traffic
                WHEN TRIM(bikelane) IN ('2', '4', '5', '6', '8', '9') THEN time_bike * 10
                -- Class 3: Signed route against traffic
                WHEN TRIM(bikelane) = '3' THEN time_bike * 15  -- 1.5 * 10
                -- No bike lane against traffic: effectively blocked
                ELSE time_bike * 100
            END

        -- CASE 3: One-way with bike direction (from->to)
        WHEN one_way_bike = 'FT' THEN
            CASE
                -- Class 1: Separated greenway with traffic (best)
                WHEN TRIM(bikelane) IN ('1', '10', '11') THEN time_bike * 0.8
                -- Class 2: Striped lane with traffic (good)
                WHEN TRIM(bikelane) IN ('2', '4', '5', '6', '8', '9') THEN time_bike * 1.0
                -- Class 3: Signed route with traffic (acceptable)
                WHEN TRIM(bikelane) = '3' THEN time_bike * 1.5
                -- No bike lane but with traffic: moderate penalty
                ELSE time_bike * 5.0
            END

        -- CASE 4: Bidirectional
        WHEN one_way_bike = 'B' THEN
            CASE
                -- Class 1: Separated greenway bidirectional (best)
                WHEN TRIM(bikelane) IN ('1', '10', '11') THEN time_bike * 0.8
                -- Class 2: Striped lane bidirectional (good)
                WHEN TRIM(bikelane) IN ('2', '4', '5', '6', '8', '9') THEN time_bike * 1.0
                -- Class 3: Signed route bidirectional (acceptable)
                WHEN TRIM(bikelane) = '3' THEN time_bike * 1.5
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
                -- Class 1: Separated greenway against traffic (reverse)
                WHEN TRIM(bikelane) IN ('1', '10', '11') THEN time_bike * 8
                -- Class 2: Striped lane against traffic (reverse)
                WHEN TRIM(bikelane) IN ('2', '4', '5', '6', '8', '9') THEN time_bike * 10
                -- Class 3: Signed route against traffic (reverse)
                WHEN TRIM(bikelane) = '3' THEN time_bike * 15
                -- No bike lane against traffic: blocked
                ELSE time_bike * 100
            END

        -- CASE 3: One-way against bike direction (reverse is with)
        WHEN one_way_bike = 'TF' THEN
            CASE
                -- Class 1: Separated greenway with traffic (reverse)
                WHEN TRIM(bikelane) IN ('1', '10', '11') THEN time_bike * 0.8
                -- Class 2: Striped lane with traffic (reverse)
                WHEN TRIM(bikelane) IN ('2', '4', '5', '6', '8', '9') THEN time_bike * 1.0
                -- Class 3: Signed route with traffic (reverse)
                WHEN TRIM(bikelane) = '3' THEN time_bike * 1.5
                -- No bike lane but with traffic
                ELSE time_bike * 5.0
            END

        -- CASE 4: Bidirectional
        WHEN one_way_bike = 'B' THEN
            CASE
                -- Class 1: Separated greenway bidirectional
                WHEN TRIM(bikelane) IN ('1', '10', '11') THEN time_bike * 0.8
                -- Class 2: Striped lane bidirectional
                WHEN TRIM(bikelane) IN ('2', '4', '5', '6', '8', '9') THEN time_bike * 1.0
                -- Class 3: Signed route bidirectional
                WHEN TRIM(bikelane) = '3' THEN time_bike * 1.5
                -- No bike lane
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
--      RW_Type Cost Adjustments (CORRECTED)
----------------------------------------------
-- Apply additional cost factors based on roadway type for more realism
-- Per LION metadata (lion_metadata.csv):
--   1=Street, 2=Highway, 3=Bridge, 4=Tunnel, 5=Boardwalk, 6=Path/Trail,
--   7=Step Street, 8=Driveway, 9=Ramp, 10=Alley, 11=Unknown,
--   12=Non-Physical, 13=U-Turn, 14=Ferry Route

-- Bridges (RW_Type = '3'): Slightly longer/more exposed
UPDATE edges
SET cost_walk = cost_walk * 1.05,
    rcost_walk = rcost_walk * 1.05
WHERE rw_type = '3' AND walkable = TRUE;

-- Tunnels (RW_Type = '4'): Less pleasant, slightly slower
UPDATE edges
SET cost_walk = cost_walk * 1.15,
    rcost_walk = rcost_walk * 1.15,
    cost_bike = cost_bike * 1.1,
    rcost_bike = rcost_bike * 1.1
WHERE rw_type = '4' AND (walkable = TRUE OR bikeable = TRUE);

-- Boardwalks (RW_Type = '5'): Pleasant for walking/biking
UPDATE edges
SET cost_walk = cost_walk * 0.9,
    rcost_walk = rcost_walk * 0.9,
    cost_bike = cost_bike * 0.9,
    rcost_bike = rcost_bike * 0.9
WHERE rw_type = '5' AND (walkable = TRUE OR bikeable = TRUE);

-- Step Streets (RW_Type = '7'): Very difficult for walking, impossible for biking
-- Note: bikelane='7' also indicates stairs and is handled in main bike cost logic
UPDATE edges
SET cost_walk = GREATEST(cost_walk, time_walk * 1.5),
    rcost_walk = GREATEST(rcost_walk, time_walk * 1.5),
    cost_bike = cost_bike * 50,  -- Effectively blocked for bikes
    rcost_bike = rcost_bike * 50
WHERE rw_type = '7' AND (walkable = TRUE OR bikeable = TRUE);

-- Ramps (RW_Type = '9'): Harder for pedestrians/bikes
UPDATE edges
SET cost_walk = cost_walk * 1.3,    -- 30% harder to walk ramps
    rcost_walk = rcost_walk * 1.3,
    cost_bike = cost_bike * 1.2,    -- 20% harder to bike ramps
    rcost_bike = rcost_bike * 1.2
WHERE rw_type = '9' AND (walkable = TRUE OR bikeable = TRUE);

-- Note: RW_Type='2' (Highway) already handled by lane count penalties
-- Note: RW_Type='14' (Ferry Route) handled separately in Ferry Accessibility section

----------------------------------------------
--      Lane Count-Based Safety Penalties
----------------------------------------------
-- Multi-lane roads are more dangerous and less pleasant for cycling/walking
-- These penalties discourage routing through high-traffic arterials

-- Wide roads (6+ lanes): harder and less safe for pedestrians to cross
UPDATE edges
SET cost_walk = cost_walk * 1.2,
    rcost_walk = rcost_walk * 1.2
WHERE number_travel_lanes >= 6 AND walkable = TRUE;

-- Multi-lane roads (4+ lanes): more dangerous for cycling without protected infrastructure
-- Only apply if no Class 1 separated greenway (already has 0.8x bonus)
UPDATE edges
SET cost_bike = cost_bike * 1.3,
    rcost_bike = rcost_bike * 1.3
WHERE number_travel_lanes >= 4
  AND bikeable = TRUE
  AND (bikelane IS NULL OR TRIM(bikelane) NOT IN ('1', '10', '11'));

----------------------------------------------
--       Ferry Cost Penalties (REVISED)
----------------------------------------------
-- IMPORTANT: This MUST run AFTER all other cost calculations
-- Ferries are bikeable/walkable per LION metadata but should be discouraged
-- unless no bridge/tunnel alternative exists.
--
-- Strategy: Apply moderate cost multiplier (5x) rather than massive penalty (1000x)
-- Time already includes 15-minute waiting penalty (see 02_travel_time.sql)
-- The 5x multiplier ensures ferries are only used when necessary (e.g., Staten Island,
-- Governors Island, Rockaway) but not for routes where bridges exist.
--
-- Note: Setting bikeable=TRUE in 02_travel_time.sql makes ferries available for routing
UPDATE edges
SET cost_walk = time_walk * 5.0,    -- 5x penalty: waiting + inconvenience
    rcost_walk = time_walk * 5.0,
    cost_bike = time_bike * 5.0,    -- 5x penalty: waiting + inconvenience
    rcost_bike = time_bike * 5.0
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

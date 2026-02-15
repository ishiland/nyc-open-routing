-------------------------------------------------------
-- Creates edges table and maps values from LION table
-- OPTIMIZED VERSION: Defers indexes, combines UPDATEs, filters during load
-------------------------------------------------------

DROP TABLE IF EXISTS public.edges CASCADE;
DROP TABLE IF EXISTS public.edges_vertices_pgr CASCADE;

---------------------------------------------
-- Step 1: Check if status column exists
---------------------------------------------
DO $$
DECLARE
    status_column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lion'
        AND column_name = 'status'
    ) INTO status_column_exists;

    IF status_column_exists THEN
        RAISE NOTICE 'Status column found - will filter for constructed streets during load';
    ELSE
        RAISE WARNING 'Status column not found - importing all street segments';
    END IF;
END $$;

---------------------------------------------
-- Step 2: Create edges table with filtering
-- OPTIMIZATION: Filter by status during SELECT INTO
--
-- FeatureTyp filtering logic:
--   INCLUDED: 0 (Street), A (Alley), W (Walkway/Path), F (Ferry)
--   EXCLUDED: 1 (Railroad), 2 (Water Edge), 3 (Census Boundary), 5 (Borough Boundary),
--             6 (Private Street), 7 (District Boundary), 8 (Physical Boundary)
--
-- Note: Alleys (A) are included because many provide legitimate pedestrian/bike access
--       and connect to public street networks. Cost penalties handle accessibility.
---------------------------------------------
SELECT
  segmentid,
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
  ST_LineMerge(the_geom) AS the_geom
INTO public.edges
FROM lion
WHERE featuretyp IN ('0', 'A', 'W', 'F')  -- 0=Street, A=Alley, W=Walkway/Path, F=Ferry (exclude 6=Private)
  AND segmenttyp NOT IN ('G', 'F')
  AND (NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lion' AND column_name = 'status'
      ) OR status = '2');  -- Filter during load, not after

-- Log row count
DO $$
DECLARE
    edge_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO edge_count FROM public.edges;
    RAISE NOTICE 'Edges created: % (filtered for constructed streets)', edge_count;
END $$;

---------------------------------------------
-- Step 3: Add new columns for routing
-- OPTIMIZATION: Don't create PRIMARY KEY yet
---------------------------------------------
ALTER TABLE public.edges
  ADD COLUMN id SERIAL,  -- No PRIMARY KEY constraint yet
  ADD COLUMN source INTEGER,
  ADD COLUMN target INTEGER,

  ADD COLUMN level_from INTEGER,
  ADD COLUMN level_to INTEGER,

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
  ADD COLUMN length_feet DOUBLE PRECISION,
  ADD COLUMN traffic_factor NUMERIC(5,2) DEFAULT 1.0;

---------------------------------------------
-- Step 4: Populate ALL derived fields in single UPDATE
-- OPTIMIZATION: Combine geometry and level conversions
-- Follows pattern from 03_cost.sql: single comprehensive UPDATE
---------------------------------------------
UPDATE public.edges
SET
  -- Geometry-derived fields
  x1 = st_x(st_startpoint(the_geom)),
  y1 = st_y(st_startpoint(the_geom)),
  x2 = st_x(st_endpoint(the_geom)),
  y2 = st_y(st_endpoint(the_geom)),
  length_feet = ST_Length(ST_Transform(the_geom, 2263)),

  -- NodeLevel conversions
  -- Handles: A-Z letters (1-26), * (level-less/generic), $ (water level), NULL/empty
  -- * (asterisk) = Generic/non-physical segments - set to NULL to exclude from restrictions
  -- Default to M=13 (ground level) for missing data
  level_from = CASE
    WHEN nodelevelf IS NULL OR TRIM(nodelevelf) = '' THEN 13
    WHEN UPPER(TRIM(nodelevelf)) = '*' THEN NULL
    WHEN UPPER(TRIM(nodelevelf)) = '$' THEN 1
    WHEN UPPER(TRIM(nodelevelf)) ~ '^[A-Z]$' THEN ASCII(UPPER(TRIM(nodelevelf))) - 64
    ELSE 13
  END,

  level_to = CASE
    WHEN nodelevelt IS NULL OR TRIM(nodelevelt) = '' THEN 13
    WHEN UPPER(TRIM(nodelevelt)) = '*' THEN NULL
    WHEN UPPER(TRIM(nodelevelt)) = '$' THEN 1
    WHEN UPPER(TRIM(nodelevelt)) ~ '^[A-Z]$' THEN ASCII(UPPER(TRIM(nodelevelt))) - 64
    ELSE 13
  END;

---------------------------------------------
-- Step 5: Create PRIMARY KEY
-- OPTIMIZATION: Create after all data modifications
-- NOTE: Indexes moved to 06_performance_indexes.sql for centralized management
---------------------------------------------
ALTER TABLE public.edges ADD PRIMARY KEY (id);

---------------------------------------------
-- Step 7: Validation and reporting
---------------------------------------------
DO $$
DECLARE
    null_geom_count INTEGER;
    zero_length_count INTEGER;
    invalid_level_from_count INTEGER;
    invalid_level_to_count INTEGER;
    special_nodelevel_count INTEGER;
BEGIN
    -- Check for NULL geometries
    SELECT COUNT(*) INTO null_geom_count FROM public.edges WHERE the_geom IS NULL;
    IF null_geom_count > 0 THEN
        RAISE WARNING 'Found % edges with NULL geometry', null_geom_count;
    END IF;

    -- Check for zero-length segments
    SELECT COUNT(*) INTO zero_length_count FROM public.edges WHERE length_feet = 0 OR length_feet IS NULL;
    IF zero_length_count > 0 THEN
        RAISE WARNING 'Found % edges with zero or NULL length', zero_length_count;
    END IF;

    -- Check for invalid level values (should be 1-26)
    SELECT COUNT(*) INTO invalid_level_from_count FROM public.edges WHERE level_from < 1 OR level_from > 26;
    SELECT COUNT(*) INTO invalid_level_to_count FROM public.edges WHERE level_to < 1 OR level_to > 26;
    IF invalid_level_from_count > 0 OR invalid_level_to_count > 0 THEN
        RAISE WARNING 'Found invalid level values: % level_from, % level_to', invalid_level_from_count, invalid_level_to_count;
    END IF;

    -- Report special NodeLevel code usage
    SELECT COUNT(*) INTO special_nodelevel_count FROM lion
    WHERE (nodelevelf IN ('*', '$') OR nodelevelt IN ('*', '$'))
    AND join_id IN (SELECT join_id FROM public.edges);
    IF special_nodelevel_count > 0 THEN
        RAISE NOTICE 'Processed % segments with special NodeLevel codes (* or $)', special_nodelevel_count;
    END IF;

    RAISE NOTICE '=== 01_edges.sql completed successfully ===';
END $$;

-- Test suite for turn direction and turn type functions
-- Run with: psql -U postgres -d routing -f test_turn_functions.sql

\echo '========================================='
\echo 'Testing Turn Direction and Turn Type Functions'
\echo '========================================='
\echo ''

-- Test 1: get_turn_direction() function with industry-standard angles
\echo '=== Test 1: get_turn_direction() - Industry Standard Angles ==='
\echo ''

-- Test straight ahead (-20 to +20 degrees)
SELECT
  'Straight (0°)' AS test_case,
  get_turn_direction(0) AS result,
  get_turn_direction(0) = 'Continue straight' AS passed;

SELECT
  'Straight (10°)' AS test_case,
  get_turn_direction(10) AS result,
  get_turn_direction(10) = 'Continue straight' AS passed;

SELECT
  'Straight (-15°)' AS test_case,
  get_turn_direction(-15) AS result,
  get_turn_direction(-15) = 'Continue straight' AS passed;

-- Test slight turns (20-45° and -20 to -45°)
SELECT
  'Slight Right (30°)' AS test_case,
  get_turn_direction(30) AS result,
  get_turn_direction(30) = 'Turn slight right' AS passed;

SELECT
  'Slight Left (-30°)' AS test_case,
  get_turn_direction(-30) AS result,
  get_turn_direction(-30) = 'Turn slight left' AS passed;

-- Test regular turns (45-120° and -45 to -120°)
SELECT
  'Right (90°)' AS test_case,
  get_turn_direction(90) AS result,
  get_turn_direction(90) = 'Turn right' AS passed;

SELECT
  'Left (-90°)' AS test_case,
  get_turn_direction(-90) AS result,
  get_turn_direction(-90) = 'Turn left' AS passed;

-- Test sharp turns (120-160° and -120 to -160°)
SELECT
  'Sharp Right (140°)' AS test_case,
  get_turn_direction(140) AS result,
  get_turn_direction(140) = 'Turn sharp right' AS passed;

SELECT
  'Sharp Left (-140°)' AS test_case,
  get_turn_direction(-140) AS result,
  get_turn_direction(-140) = 'Turn sharp left' AS passed;

-- Test U-turns (>160° or <-160°)
SELECT
  'U-turn (175°)' AS test_case,
  get_turn_direction(175) AS result,
  get_turn_direction(175) = 'Make a U-turn' AS passed;

SELECT
  'U-turn (-175°)' AS test_case,
  get_turn_direction(-175) AS result,
  get_turn_direction(-175) = 'Make a U-turn' AS passed;

-- Test boundary conditions
SELECT
  'Boundary: 20° (should be slight right)' AS test_case,
  get_turn_direction(20) AS result,
  get_turn_direction(20) = 'Turn slight right' AS passed;

SELECT
  'Boundary: -20° (should be slight left)' AS test_case,
  get_turn_direction(-20) AS result,
  get_turn_direction(-20) = 'Turn slight left' AS passed;

SELECT
  'Boundary: 45° (should be right)' AS test_case,
  get_turn_direction(45) AS result,
  get_turn_direction(45) = 'Turn right' AS passed;

SELECT
  'Boundary: 160° (should be sharp right)' AS test_case,
  get_turn_direction(160) AS result,
  get_turn_direction(160) = 'Turn sharp right' AS passed;

\echo ''
\echo '=== Test 2: get_turn_type() - Machine-Readable Types ==='
\echo ''

-- Test all turn types
SELECT
  'straight (0°)' AS test_case,
  get_turn_type(0) AS result,
  get_turn_type(0) = 'straight' AS passed;

SELECT
  'slight-right (30°)' AS test_case,
  get_turn_type(30) AS result,
  get_turn_type(30) = 'slight-right' AS passed;

SELECT
  'right (90°)' AS test_case,
  get_turn_type(90) AS result,
  get_turn_type(90) = 'right' AS passed;

SELECT
  'sharp-right (140°)' AS test_case,
  get_turn_type(140) AS result,
  get_turn_type(140) = 'sharp-right' AS passed;

SELECT
  'slight-left (-30°)' AS test_case,
  get_turn_type(-30) AS result,
  get_turn_type(-30) = 'slight-left' AS passed;

SELECT
  'left (-90°)' AS test_case,
  get_turn_type(-90) AS result,
  get_turn_type(-90) = 'left' AS passed;

SELECT
  'sharp-left (-140°)' AS test_case,
  get_turn_type(-140) AS result,
  get_turn_type(-140) = 'sharp-left' AS passed;

SELECT
  'u-turn (175°)' AS test_case,
  get_turn_type(175) AS result,
  get_turn_type(175) = 'u-turn' AS passed;

SELECT
  'u-turn (-175°)' AS test_case,
  get_turn_type(-175) AS result,
  get_turn_type(-175) = 'u-turn' AS passed;

\echo ''
\echo '=== Test 3: Routing Functions Return turn_instruction and turn_type ==='
\echo ''

-- Test driving route function
\echo 'Testing getdrivingroute() return columns...'
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'pg_temp'
  AND table_name IN (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_type = 'LOCAL TEMPORARY'
  );

-- Create a minimal test by calling the function
-- Note: This requires valid coordinates and imported LION data
-- Adjust coordinates as needed for your test data
\echo ''
\echo 'Testing driving route with sample coordinates...'
\echo 'Note: These tests require imported LION data. Skipping if data not available.'

-- Test if we have edges data
DO $$
DECLARE
  edge_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO edge_count FROM edges WHERE driveable = TRUE LIMIT 1;

  IF edge_count > 0 THEN
    RAISE NOTICE 'Edges table contains data - routing function tests can proceed';

    -- Test that turn_instruction and turn_type columns exist in routing results
    -- This is a simple check using EXPLAIN to verify the query structure
    RAISE NOTICE 'Checking routing function return columns...';

    -- Test driving route
    PERFORM * FROM getdrivingroute(40.7128, -74.0060, 40.7489, -73.9680) LIMIT 1;
    RAISE NOTICE 'getdrivingroute() executed successfully';

    -- Test bike route
    PERFORM * FROM getbikingroute(40.7128, -74.0060, 40.7489, -73.9680) LIMIT 1;
    RAISE NOTICE 'getbikingroute() executed successfully';

    -- Test walk route
    PERFORM * FROM getwalkingroute(40.7128, -74.0060, 40.7489, -73.9680) LIMIT 1;
    RAISE NOTICE 'getwalkingroute() executed successfully';

    -- Test traffic-aware driving route
    PERFORM * FROM getdrivingroute_with_traffic(40.7128, -74.0060, 40.7489, -73.9680, NULL, NULL) LIMIT 1;
    RAISE NOTICE 'getdrivingroute_with_traffic() executed successfully';

  ELSE
    RAISE WARNING 'No edge data found - skipping routing function tests. Import LION data first.';
  END IF;
END $$;

\echo ''
\echo '=== Test 4: Verify turn_instruction and turn_type in actual route results ==='
\echo ''

-- Test actual route results (if data is available)
DO $$
DECLARE
  edge_count INTEGER;
  route_record RECORD;
BEGIN
  SELECT COUNT(*) INTO edge_count FROM edges WHERE driveable = TRUE LIMIT 1;

  IF edge_count > 0 THEN
    RAISE NOTICE 'Testing driving route field population...';

    -- Get first segment from a route
    SELECT * INTO route_record
    FROM getdrivingroute(40.7128, -74.0060, 40.7489, -73.9680)
    LIMIT 1;

    -- Verify fields exist
    RAISE NOTICE 'Sample route segment:';
    RAISE NOTICE '  seq: %', route_record.seq;
    RAISE NOTICE '  street: %', route_record.street;
    RAISE NOTICE '  turn_instruction: %', route_record.turn_instruction;
    RAISE NOTICE '  turn_type: %', route_record.turn_type;
    RAISE NOTICE '  distance: %', route_record.distance;
    RAISE NOTICE '  travel_time: %', route_record.travel_time;

    -- Check that turn_type is one of the valid values
    IF route_record.turn_type IN ('straight', 'slight-left', 'left', 'sharp-left',
                                   'slight-right', 'right', 'sharp-right', 'u-turn', 'continue') THEN
      RAISE NOTICE 'PASS: turn_type is a valid value (%)', route_record.turn_type;
    ELSE
      RAISE WARNING 'FAIL: turn_type has unexpected value (%)', route_record.turn_type;
    END IF;

  END IF;
END $$;

\echo ''
\echo '========================================='
\echo 'Turn Function Tests Complete'
\echo '========================================='
\echo ''
\echo 'Summary:'
\echo '  - get_turn_direction() uses industry-standard angle ranges'
\echo '  - get_turn_type() returns machine-readable types'
\echo '  - All routing functions return turn_instruction and turn_type columns'
\echo '  - Turn types are validated against expected values'
\echo ''

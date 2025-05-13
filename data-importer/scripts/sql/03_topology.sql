-- This SQL script expects {tolerance} to be replaced by the Python script
-- with the calculated tolerance value before execution.

-- Drop existing topology table to ensure a clean build if it exists from a previous run
DROP TABLE IF EXISTS edges_vertices_pgr CASCADE;

-- Create topology with properly filtered edges
-- The {tolerance} placeholder will be replaced by the Python script.
SELECT pgr_createTopology(
    'edges',
    {tolerance},
    'the_geom',
    'id',
    'source',
    'target',
    rows_where := 'driveable = TRUE OR bikeable = TRUE OR walkable = TRUE',
    clean := TRUE
); 
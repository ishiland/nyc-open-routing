This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
4. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: data-importer
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

## Additional Info

# Directory Structure
```
data-importer/
  data/
    .gitignore
  scripts/
    sql/
      01_edges.sql
      02_travel_time.sql
      03_topology.sql
      04_cost.sql
      05_functions.sql
    create_network.py
    import-lion.sh
    README.md
```

# Files

## File: data-importer/scripts/sql/01_edges.sql
````sql
-------------------------------------------------------
-- Creates edges table and maps values from LION table
-------------------------------------------------------

DROP TABLE IF EXISTS public.edges;
DROP TABLE IF EXISTS public.edges_vertices_pgr;

SELECT
  join_id,
  street,
  trafdir,
  featuretyp,
  nonped,
  (ST_Dump(the_geom)).geom AS the_geom -- Explode MultiLineStrings into LineStrings
INTO public.edges
FROM lion
WHERE featuretyp IN ('0', 'A', '6', 'W', 'F');


-- create indexes
CREATE INDEX IF NOT EXISTS edges_join_id_idx
  ON public.edges (join_id);
CREATE INDEX IF NOT EXISTS edges_geom_idx
  ON public.edges USING GIST (the_geom);

-- fields to be populated
ALTER TABLE public.edges
  ADD COLUMN id SERIAL PRIMARY KEY,
  ADD COLUMN source INTEGER,
  ADD COLUMN target INTEGER,

  ADD COLUMN time_drive DOUBLE PRECISION,
  ADD COLUMN cost_drive DOUBLE PRECISION,
  ADD COLUMN rcost_drive DOUBLE PRECISION,

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
  ADD COLUMN the_geom_4326 GEOMETRY(LineString, 4326);

CREATE INDEX lion_source_idx
  ON public.edges USING BTREE (source);
CREATE INDEX lion_target_idx
  ON public.edges USING BTREE (target);
CREATE INDEX lion_featuretyp_idx
  ON public.edges USING BTREE (featuretyp);

UPDATE public.edges
SET x1        = st_x(st_startpoint(the_geom)),
  y1          = st_y(st_startpoint(the_geom)),
  x2          = st_x(st_endpoint(the_geom)),
  y2          = st_y(st_endpoint(the_geom)),
  length_feet = ST_Length(ST_Transform(the_geom, 2263)),
  the_geom_4326 = ST_Transform(the_geom, 4326);

CREATE INDEX IF NOT EXISTS edges_the_geom_4326_idx
  ON public.edges USING GIST (the_geom_4326);
````

## File: data-importer/scripts/sql/02_travel_time.sql
````sql
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
SET time_drive = (length_feet :: NUMERIC / 5280) / (25.0 / 60.0), -- Fixed 25 mph
  time_bike    = (length_feet :: NUMERIC / 5280) / (12.0 / 60.0), -- Fixed 12 mph
  time_walk    = (length_feet :: NUMERIC / 5280) / (3.0 / 60.0); -- Fixed 3 mph

-- For Ferry routes
UPDATE public.edges
SET time_bike = (length_feet :: NUMERIC / 5280) / (25.0 / 60.0), -- Fixed 25 mph for ferry biking
  time_walk   = (length_feet :: NUMERIC / 5280) / (25.0 / 60.0)  -- Fixed 25 mph for ferry walking
WHERE featuretyp = 'F';
````

## File: data-importer/scripts/sql/03_topology.sql
````sql
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
````

## File: data-importer/scripts/sql/04_cost.sql
````sql
---------------------------------------------
-- Helper Indexes for updates -- REMOVED as columns are no longer present or needed for MVP cost logic
---------------------------------------------
-- CREATE INDEX IF NOT EXISTS idx_edges_one_way ON edges (one_way); -- REMOVED
-- CREATE INDEX IF NOT EXISTS idx_edges_trafdir ON edges (trafdir); -- REMOVED (trafdir still exists, but not used in this simplified cost logic directly for indexing)
-- CREATE INDEX IF NOT EXISTS idx_edges_one_way_bike ON edges (one_way_bike); -- REMOVED
-- CREATE INDEX IF NOT EXISTS idx_edges_bike_trafdir_nullable ON edges (bike_trafdir); -- REMOVED
-- CREATE INDEX IF NOT EXISTS idx_edges_bikelane_nullable ON edges (bikelane); -- REMOVED

---------------------------------------------
--              Consolidated Costs Update
---------------------------------------------
UPDATE edges
SET
    cost_drive = CASE WHEN driveable = TRUE THEN time_drive ELSE NULL END,
    rcost_drive = CASE WHEN driveable = TRUE THEN time_drive ELSE NULL END, -- MVP: rcost = cost
    cost_bike = CASE WHEN bikeable = TRUE THEN time_bike ELSE NULL END,
    rcost_bike = CASE WHEN bikeable = TRUE THEN time_bike ELSE NULL END, -- MVP: rcost = cost
    cost_walk = CASE WHEN walkable = TRUE THEN time_walk ELSE NULL END,
    rcost_walk = CASE WHEN walkable = TRUE THEN time_walk ELSE NULL END; -- MVP: rcost = cost

-- Separate update for walk costs to ensure all walkable edges get costs -- REMOVED as it's consolidated above
-- regardless of whether they're bikeable or not -- REMOVED
-- UPDATE edges -- REMOVED
-- SET -- REMOVED
--     cost_walk = time_walk, -- REMOVED
--     rcost_walk = time_walk -- REMOVED
-- WHERE walkable = TRUE; -- REMOVED

----------------------------------------------
-- Multi-column indexes for filtering
----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_edges_driveable_cost ON edges (driveable, cost_drive);
CREATE INDEX IF NOT EXISTS idx_edges_bikeable_cost ON edges (bikeable, cost_bike);
CREATE INDEX IF NOT EXISTS idx_edges_walkable_cost ON edges (walkable, cost_walk);

-- It might also be beneficial to have indexes for reverse costs if queries use them similarly
CREATE INDEX IF NOT EXISTS idx_edges_driveable_rcost ON edges (driveable, rcost_drive);
CREATE INDEX IF NOT EXISTS idx_edges_bikeable_rcost ON edges (bikeable, rcost_bike);
CREATE INDEX IF NOT EXISTS idx_edges_walkable_rcost ON edges (walkable, rcost_walk);

-- Cost indexes
CREATE INDEX IF NOT EXISTS idx_edges_cost_drive ON edges(cost_drive);
CREATE INDEX IF NOT EXISTS idx_edges_cost_bike ON edges(cost_bike);
CREATE INDEX IF NOT EXISTS idx_edges_cost_walk ON edges(cost_walk);
````

## File: data-importer/scripts/sql/05_functions.sql
````sql
-- get nearest node - used by all routing functions.
-- First drop the existing function to allow parameter changes
DROP FUNCTION IF EXISTS getnearestnode(double precision, double precision);

-- Helper function to determine turn direction based on angle
DROP FUNCTION IF EXISTS get_turn_direction(double precision);

-- Generic routing function
-- Drop old signature (6 parameters)
DROP FUNCTION IF EXISTS _getroute(TEXT, TEXT, double precision, double precision, double precision, double precision);
-- Drop new signature (7 parameters) for idempotency
DROP FUNCTION IF EXISTS _getroute(TEXT, TEXT, TEXT, double precision, double precision, double precision, double precision);

-- driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute(double precision,double precision,double precision,double precision);
CREATE OR REPLACE FUNCTION getdrivingroute(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  WITH
    start AS (SELECT id AS node FROM edges_vertices_pgr ORDER BY the_geom_4326 <-> ST_SetSRID(ST_MakePoint(lon1,lat1),4326) LIMIT 1),
    finish AS (SELECT id AS node FROM edges_vertices_pgr ORDER BY the_geom_4326 <-> ST_SetSRID(ST_MakePoint(lon2,lat2),4326) LIMIT 1),
    route AS (
      SELECT * FROM pgr_dijkstra(
        'SELECT id, source, target, cost_drive, rcost_drive FROM edges WHERE cost_drive IS NOT NULL AND rcost_drive IS NOT NULL', -- Added WHERE clause for safety
        (SELECT node FROM start),
        (SELECT node FROM finish),
        directed := true
      )
    )
  SELECT
    r.seq, r.edge AS edge_id, e.street, e.cost_drive AS cost, e.the_geom_4326 AS geom
  FROM route r JOIN edges e ON r.edge = e.id
  ORDER BY r.seq;
$$ LANGUAGE SQL IMMUTABLE;

-- biking route with turn instructions
DROP FUNCTION IF EXISTS getbikingroute(double precision,double precision,double precision,double precision);
CREATE OR REPLACE FUNCTION getbikingroute(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  WITH
    start AS (SELECT id AS node FROM edges_vertices_pgr ORDER BY the_geom_4326 <-> ST_SetSRID(ST_MakePoint(lon1,lat1),4326) LIMIT 1),
    finish AS (SELECT id AS node FROM edges_vertices_pgr ORDER BY the_geom_4326 <-> ST_SetSRID(ST_MakePoint(lon2,lat2),4326) LIMIT 1),
    route AS (
      SELECT * FROM pgr_dijkstra(
        'SELECT id, source, target, cost_bike, rcost_bike FROM edges WHERE cost_bike IS NOT NULL AND rcost_bike IS NOT NULL', -- Added WHERE clause for safety
        (SELECT node FROM start),
        (SELECT node FROM finish),
        directed := true
      )
    )
  SELECT
    r.seq, r.edge AS edge_id, e.street, e.cost_bike AS cost, e.the_geom_4326 AS geom
  FROM route r JOIN edges e ON r.edge = e.id
  ORDER BY r.seq;
$$ LANGUAGE SQL IMMUTABLE;

-- walking route with turn instructions
DROP FUNCTION IF EXISTS getwalkingroute(double precision,double precision,double precision,double precision);
CREATE OR REPLACE FUNCTION getwalkingroute(lon1 FLOAT, lat1 FLOAT, lon2 FLOAT, lat2 FLOAT)
RETURNS TABLE(seq INT, edge_id BIGINT, street TEXT, cost FLOAT, geom GEOMETRY) AS
$$
  WITH
    start AS (SELECT id AS node FROM edges_vertices_pgr ORDER BY the_geom_4326 <-> ST_SetSRID(ST_MakePoint(lon1,lat1),4326) LIMIT 1),
    finish AS (SELECT id AS node FROM edges_vertices_pgr ORDER BY the_geom_4326 <-> ST_SetSRID(ST_MakePoint(lon2,lat2),4326) LIMIT 1),
    route AS (
      SELECT * FROM pgr_dijkstra(
        'SELECT id, source, target, cost_walk, rcost_walk FROM edges WHERE cost_walk IS NOT NULL AND rcost_walk IS NOT NULL', -- Added WHERE clause for safety
        (SELECT node FROM start),
        (SELECT node FROM finish),
        directed := true
      )
    )
  SELECT
    r.seq, r.edge AS edge_id, e.street, e.cost_walk AS cost, e.the_geom_4326 AS geom
  FROM route r JOIN edges e ON r.edge = e.id
  ORDER BY r.seq;
$$ LANGUAGE SQL IMMUTABLE;

-- traffic-aware driving route with turn instructions
DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision, integer, integer);

DROP FUNCTION IF EXISTS getdrivingroute_current_traffic(double precision, double precision, double precision, double precision);
````

## File: data-importer/data/.gitignore
````
# Ignore everything in this directory
*
# Except this file
!.gitignore
````

## File: data-importer/scripts/README.md
````markdown
# NYC Open Routing - Data Importer

This module imports NYC LION data and creates a routable network for pgRouting.

## Features

- Creates a routable network from NYC LION data
- Calculates travel times for driving, walking, and biking
- Handles grade-separated intersections with turn restrictions
- Fixes network fragmentation issues
- Supports traffic volume data integration for time-based routing

## Usage

### Basic Import

```bash
# Import using default LION version
./import-lion.sh

# Import specific LION version
./import-lion.sh 23a
```

### Import with Traffic Data

You can import traffic volume data to enable time-based routing with traffic considerations:

```bash
# Automatically download traffic data from NYC Open Data
./import-lion.sh 23a --download-traffic

# Or use a local traffic data file
./import-lion.sh 23a --traffic-file /path/to/traffic_data.csv
```

The traffic data should be in the NYC DOT Automated Traffic Volume Counts format, available from:
https://data.cityofnewyork.us/api/views/7ym2-wayt/rows.csv

### All Options

```
Usage: ./import-lion.sh [LION_VERSION] [OPTIONS]
Options:
  --download-traffic  Download latest traffic volume data from NYC Open Data
  --traffic-file PATH  Use local traffic data file at PATH

Examples:
  ./import-lion.sh 23a                            # Import LION 23a without traffic data
  ./import-lion.sh 23a --download-traffic         # Import LION 23a and download traffic data
  ./import-lion.sh 23a --traffic-file data.csv    # Import LION 23a with local traffic data
```

## Available Routing Functions

After importing the data, the following routing functions will be available:

### Standard Routing

- `getdrivingroute(start_lon, start_lat, end_lon, end_lat)` - Calculate driving route
- `getbikingroute(start_lon, start_lat, end_lon, end_lat)` - Calculate biking route
- `getwalkingroute(start_lon, start_lat, end_lon, end_lat)` - Calculate walking route

### Traffic-Based Routing (if traffic data was imported)

- `getdrivingroute_with_traffic(start_lon, start_lat, end_lon, end_lat, hour, day_of_week)` - Calculate driving route considering traffic data for specified time
- `getdrivingroute_current_traffic(start_lon, start_lat, end_lon, end_lat)` - Calculate driving route considering current time's traffic data

#### Parameters for traffic-based routing:

- `hour`: Hour of day (0-23)
- `day_of_week`: Day of week (1=Monday, 7=Sunday)

## Example Queries

Basic routing:
```sql
SELECT * FROM getdrivingroute(-74.0060, 40.7128, -73.9855, 40.7580);
```

Traffic-based routing for 8 AM on Monday:
```sql
SELECT * FROM getdrivingroute_with_traffic(-74.0060, 40.7128, -73.9855, 40.7580, 8, 1);
```

Current traffic conditions:
```sql
SELECT * FROM getdrivingroute_current_traffic(-74.0060, 40.7128, -73.9855, 40.7580);
```
````

## File: data-importer/scripts/create_network.py
````python
import os
import string
import logging
from datetime import datetime
import psycopg
import concurrent.futures # Re-enable this
from tqdm import tqdm 
import csv
import sqlparse
import re

# Configure logging to work with tqdm
class TqdmLoggingHandler(logging.Handler):
    def __init__(self, level=logging.NOTSET):
        super().__init__(level)

    def emit(self, record):
        try:
            msg = self.format(record)
            tqdm.write(msg)
            self.flush()
        except Exception:
            self.handleError(record)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[TqdmLoggingHandler()]
)
logger = logging.getLogger('network_builder')

# Configuration parameters
CONFIG = {
    'tolerance': {
        'wgs84': 0.0003,  # ~30m in degrees for WGS84
        'state_plane': 1.0  # 1 foot for State Plane (EPSG:2263)
    },
    'speeds': {
        'drive_mph': float(os.getenv('DRIVE_SPEED_MPH', '25')),
        'walk_mph': float(os.getenv('WALK_SPEED_MPH', '3')),
        'bike_mph': float(os.getenv('BIKE_SPEED_MPH', '12')),
        'ferry_mph': float(os.getenv('FERRY_SPEED_MPH', '25'))
    }
    # Cost multipliers removed as 04_cost.sql is simplified
    # Traffic required flag removed as traffic processing is out of scope for MVP
}

# Log the configuration
logger.info(f"Speed config (for reference/smoke tests): {CONFIG['speeds']}")

def execute_sql_file(cur, conn, file_path):
    """Execute SQL from files. Assumes it's within a caller-managed transaction."""
    try:
        with open(file_path, 'r') as file:
            sql_content = file.read()
        
        # Split the SQL content into individual statements
        parsed_statements = sqlparse.split(sql_content)
        
        for stmt in parsed_statements:
            stmt = stmt.strip()
            if not stmt:
                continue
            cur.execute(stmt)
            
        return True # Indicates statements were executed by the cursor
    except Exception as e:
        logger.error(f"Error executing SQL file {file_path}: {e}")
        # No rollback here - caller manages transaction. Re-raise to signal failure.
        raise

def perform_maintenance(cur, conn):
    """Maintain database performance. Assumes it's within a caller-managed transaction or will manage its own."""
    try:
        # If called outside a transaction, these should ideally be transactional.
        # However, REINDEX and ANALYZE are often run as standalone maintenance.
        # For simplicity here, let's assume they can auto-commit or the caller handles it.
        # If strict transactionality is needed for these too, the caller should wrap them.
        cur.execute("REINDEX INDEX edges_vertices_pgr_idx;")
        cur.execute("ANALYZE edges_vertices_pgr;")
        cur.execute("ANALYZE edges;")
        # conn.commit() # Removed: Caller or auto-commit for maintenance commands
        return True
    except Exception as e:
        logger.error(f"Error during maintenance: {e}")
        # conn.rollback() # Removed
        raise # Re-raise to indicate maintenance failure

def create_edges_table(cur, conn, sql_script_path):
    """Create and prepare edges table by executing 01_edges.sql and performing post-processing.
       Assumes it's within a caller-managed transaction.
    """
    logger.info(f'Creating edges table using {sql_script_path}...')
    execute_sql_file(cur, conn, sql_script_path) # Executes 01_edges.sql
    
    # Python-specific post-processing for edges table
    logger.info("Validating geometries in edges table...")
    cur.execute("SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(the_geom);")
    invalid_count = cur.fetchone()[0]
    if invalid_count > 0:
        logger.warning(f"Found {invalid_count} invalid geometries, fixing...")
        cur.execute("UPDATE edges SET the_geom = ST_MakeValid(the_geom) WHERE NOT ST_IsValid(the_geom);")
    else:
        logger.info("All geometries in edges table are valid.")
    
    # MVP Simplification: Removed nodelevel/grade separation/turn restriction logic from Python.
    # This should be handled by SQL if needed, or is out of MVP scope.
    # The 01_edges.sql should create all necessary columns and basic indexes.
    
    logger.info("Clustering edges table by geometry after creation...")
    # Ensure edges_geom_idx is created by 01_edges.sql before clustering
    cur.execute("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'edges_geom_idx' AND n.nspname = 'public';")
    if cur.fetchone():
        cur.execute("CLUSTER VERBOSE edges USING edges_geom_idx;")
    else:
        logger.warning("Index edges_geom_idx not found. Skipping CLUSTER.")

    logger.info("Analyzing edges table after clustering...")
    cur.execute("ANALYZE edges;")
    logger.info("Edges table creation and post-processing complete.")

def create_topology(cur, conn, sql_script_path, connect_params):
    """Create network topology using pgRouting by executing 03_topology.sql (templated)
       and performing post-processing. Assumes it's within a caller-managed transaction.
    """
    logger.info(f"Creating network topology using {sql_script_path}...")
    try:
        # Determine which tolerance to use based on CRS of the_geom
        cur.execute("SELECT ST_SRID(the_geom) FROM edges LIMIT 1;")
        srid_result = cur.fetchone()
        if not srid_result:
            raise Exception("Could not determine SRID from edges table. Is the table empty or the_geom not populated?")
        srid = srid_result[0]
        
        if srid == 2263:  # EPSG:2263 (NY State Plane - feet)
            tolerance = CONFIG['tolerance']['state_plane']
            logger.info(f"Using State Plane (EPSG:2263) tolerance of {tolerance} feet for topology")
        else:  # Assume WGS84 or other
            tolerance = CONFIG['tolerance']['wgs84']
            logger.info(f"Using WGS84 tolerance of {tolerance} degrees for topology (SRID: {srid})")

        # Read the 03_topology.sql content
        with open(sql_script_path, 'r') as file:
            topology_sql_template = file.read()
        
        # Replace the {tolerance} placeholder
        topology_sql = topology_sql_template.replace('{tolerance}', str(tolerance))
            
        logger.info(f"Running templated pgr_createTopology from {sql_script_path} with tolerance: {tolerance}...")
        # Execute the templated SQL (which includes DROP TABLE and pgr_createTopology)
        parsed_statements = sqlparse.split(topology_sql)
        for stmt in parsed_statements:
            stmt = stmt.strip()
            if not stmt: # Skip empty statements
                continue
            if stmt.startswith('--'): # Skip comment lines if they are parsed as separate statements
                continue
            cur.execute(stmt)
            
        logger.info("Topology created via SQL script. Creating indexes on edges_vertices_pgr...")
        # Python-specific post-processing for topology
        cur.execute("CREATE INDEX IF NOT EXISTS edges_vertices_pgr_idx ON edges_vertices_pgr USING GIST (the_geom);")
        cur.execute("CREATE INDEX IF NOT EXISTS edges_vertices_pgr_id_idx ON edges_vertices_pgr (id);")
        
        logger.info("Analyzing edges_vertices_pgr table...")
        cur.execute("ANALYZE edges_vertices_pgr;")

        logger.info("Adding and populating the_geom_4326 column in edges_vertices_pgr...")
        cur.execute("ALTER TABLE edges_vertices_pgr ADD COLUMN IF NOT EXISTS the_geom_4326 GEOMETRY(Point, 4326);");
        cur.execute("UPDATE edges_vertices_pgr SET the_geom_4326 = ST_Transform(the_geom, 4326) WHERE the_geom_4326 IS NULL;");
        logger.info("Creating GiST index on edges_vertices_pgr.the_geom_4326...")
        cur.execute("CREATE INDEX IF NOT EXISTS edges_vertices_pgr_the_geom_4326_idx ON edges_vertices_pgr USING GIST (the_geom_4326);");
        logger.info("Analyzing edges_vertices_pgr table again after adding new column and index...")
        cur.execute("ANALYZE edges_vertices_pgr;")

        logger.info("Analyzing edges table after topology creation (source/target updates)...")
        cur.execute("ANALYZE edges;")

        # Quality Check: Ensure edges_vertices_pgr is populated
        cur.execute("SELECT COUNT(*) FROM edges_vertices_pgr;")
        node_count = cur.fetchone()[0]
        logger.info(f"Topology created with {node_count} nodes in edges_vertices_pgr.")
        if node_count == 0:
            logger.error("CRITICAL: edges_vertices_pgr table is empty after topology creation. This indicates a serious problem.")
            raise Exception("Topology creation resulted in an empty edges_vertices_pgr table.")

        logger.info("Network topology creation and indexing complete.")
        return True
    except Exception as e:
        logger.error(f"Error creating network topology: {e}")
        # Print detailed diagnostics for topology errors (existing logic)
        logger.error("Topology creation diagnostics:")
        try:
            cur.execute("SELECT COUNT(*) FROM edges;")
            edges_count = cur.fetchone()[0]
            logger.error(f"- Total edges: {edges_count}")
            cur.execute("SELECT COUNT(*) FROM edges WHERE driveable = TRUE OR bikeable = TRUE OR walkable = TRUE;")
            routable_count = cur.fetchone()[0]
            logger.error(f"- Routable edges: {routable_count}")
            cur.execute("SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(the_geom);")
            invalid_geom_count = cur.fetchone()[0]
            logger.error(f"- Invalid geometries: {invalid_geom_count}")
        except Exception as diag_error:
            logger.error(f"Error during diagnostics: {diag_error}")
        raise

def calculate_travel_times(cur, conn, sql_script_path):
    """Calculate travel times for different modes by executing 02_travel_time.sql.
       Assumes it's within a caller-managed transaction.
       MVP: Speeds are hardcoded in 02_travel_time.sql, so no Python templating needed here.
    """
    logger.info(f"Calculating travel times using {sql_script_path}...")
    try:
        execute_sql_file(cur, conn, sql_script_path) # Executes 02_travel_time.sql
        logger.info("Travel times calculated. Analyzing edges table...")
        cur.execute("ANALYZE edges;")
        logger.info("Travel time calculation and analysis complete.")
        return True
    except Exception as e:
        logger.error(f"Error calculating travel times: {e}")
        raise


def create_functions(cur, conn, sql_script_path):
    """Create routing functions by executing 05_functions.sql.
       Assumes it's within a caller-managed transaction.
       MVP: 05_functions.sql contains the three simple wrapper functions.
       Parameterization logic for speeds (create_parameterized_functions) is removed for MVP.
    """
    logger.info(f"Creating routing functions from {sql_script_path}...")
    try:
        execute_sql_file(cur, conn, sql_script_path) # Executes 05_functions.sql
        logger.info("Routing functions created from SQL file.")
        return True
    except Exception as e:
        logger.error(f"Error creating functions: {e}")
        raise

def import_traffic_volumes(cur, conn, csv_file_path):
    """Import traffic volume data from CSV file. Relies on caller-managed transaction."""
    if not csv_file_path or not os.path.exists(csv_file_path):
        logger.info("No traffic data file specified or file not found")
        return False
        
    logger.info(f"Importing traffic data from {csv_file_path}...")
    
    try:
        # Create traffic_volumes table
        cur.execute("""
            DROP TABLE IF EXISTS traffic_volumes;
            CREATE TABLE traffic_volumes (
                id SERIAL PRIMARY KEY,
                request_id INTEGER,
                borough TEXT,
                count_date DATE,
                count_time TIME,
                volume INTEGER,
                segment_id BIGINT,
                location GEOMETRY(POINT, 2263),
                street TEXT,
                from_street TEXT,
                to_street TEXT,
                direction TEXT,
                hour_of_day INTEGER,
                day_of_week INTEGER
            );
        """)
        # No commit here, caller manages transaction
        
        # Read and process CSV
        processed_rows = 0
        batch_size = 5000
        batch_data = []
        
        with open(csv_file_path, 'r') as file:
            reader = csv.DictReader(file)
            
            for row in tqdm(reader, desc="Processing traffic data"):
                try:
                    # Parse data
                    request_id = int(row['RequestID']) if row['RequestID'] else None
                    borough = row['Boro']
                    year = int(row['Yr'])
                    month = int(row['M'])
                    day = int(row['D'])
                    hour = int(row['HH'])
                    minute = int(row['MM'])
                    volume = int(row['Vol'])
                    segment_id = int(row['SegmentID']) if row['SegmentID'] else None
                    wkt_geom = row['WktGeom']
                    street = row['street']
                    from_street = row['fromSt']
                    to_street = row['toSt']
                    direction = row['Direction']
                    
                    # Format date and time
                    count_date = f"20{year}-{month:02d}-{day:02d}" if year < 100 else f"{year}-{month:02d}-{day:02d}"
                    count_time = f"{hour:02d}:{minute:02d}:00"
                    
                    # Calculate day of week (1=Monday, 7=Sunday)
                    day_of_week = datetime.strptime(count_date, "%Y-%m-%d").weekday() + 1
                    
                    # Add to batch
                    batch_data.append({
                        'request_id': request_id,
                        'borough': borough,
                        'count_date': count_date,
                        'count_time': count_time,
                        'volume': volume,
                        'segment_id': segment_id,
                        'wkt_geom': wkt_geom,
                        'street': street,
                        'from_street': from_street,
                        'to_street': to_street,
                        'direction': direction,
                        'hour_of_day': hour,
                        'day_of_week': day_of_week
                    })
                    
                    # Process in batches
                    if len(batch_data) >= batch_size:
                        _insert_traffic_batch(cur, batch_data)
                        processed_rows += len(batch_data)
                        batch_data = []
                        
                except Exception as e:
                    logger.error(f"Error processing traffic data row: {e}")
                    continue
        
        # Insert any remaining data
        if batch_data:
            _insert_traffic_batch(cur, batch_data)
            processed_rows += len(batch_data)
        
        # Create indexes
        cur.execute("""
            CREATE INDEX traffic_volumes_segment_idx ON traffic_volumes(segment_id);
            CREATE INDEX traffic_volumes_time_idx ON traffic_volumes(hour_of_day, day_of_week);
            CREATE INDEX traffic_volumes_date_idx ON traffic_volumes(count_date);
        """)
        # No commit here, caller manages transaction
        
        logger.info(f"Imported {processed_rows} traffic records")
        return True
    except Exception as e:
        logger.error(f"Error importing traffic data: {e}")
        # No rollback here, caller manages transaction
        raise  # Re-raise to indicate failure

def _insert_traffic_batch(cur, batch_data):
    """Insert a batch of traffic volume data using execute_values. Relies on caller-managed transaction."""
    try:
        # Prepare data for execute_values: list of tuples
        values_to_insert = []
        for item in batch_data:
            values_to_insert.append((
                item['request_id'],
                item['borough'],
                item['count_date'],
                item['count_time'],
                item['volume'],
                item['segment_id'],
                item['wkt_geom'], # This will be converted by ST_GeomFromText in the query
                item['street'],
                item['from_street'],
                item['to_street'],
                item['direction'],
                item['hour_of_day'],
                item['day_of_week']
            ))

        # The page_size argument for execute_values is important for performance
        # It determines how many rows are sent to the server in each INSERT statement.
        # A good starting point is often between 100 and 1000.
        cur.executemany(
            """
            INSERT INTO traffic_volumes 
            (request_id, borough, count_date, count_time,
             volume, segment_id,
             location, street, from_street, to_street,
             direction, hour_of_day, day_of_week)
            VALUES (
              %s, %s, %s, %s,
              %s, %s,
              ST_GeomFromText(%s, 2263),
              %s, %s, %s,
              %s, %s, %s
            )
            """,
            values_to_insert
        )
        # No commit here, caller manages transaction
    except Exception as e:
        logger.error(f"Error inserting traffic batch: {e}")
        # No rollback here, caller manages transaction
        raise  # Re-raise to indicate failure

def process_traffic_data(cur, conn):
    """Process traffic data to create traffic factors. Relies on caller-managed transaction."""
    logger.info("Processing traffic data...")
    
    try:
        # Check for required data
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'traffic_volumes');")
        if not cur.fetchone()[0]:
            logger.warning("No traffic volumes table found - skipping traffic processing")
            return False
        
        cur.execute("SELECT COUNT(*) FROM traffic_volumes;")
        if cur.fetchone()[0] == 0:
            logger.warning("Traffic volumes table is empty - skipping traffic processing")
            return False
        
        # Create aggregated traffic table
        cur.execute("""
            DROP TABLE IF EXISTS avg_traffic_by_segment;
            CREATE TABLE avg_traffic_by_segment AS
            SELECT 
                segment_id, 
                hour_of_day,
                day_of_week,
                AVG(volume) as avg_volume,
                MAX(volume) as max_volume,
                COUNT(*) as sample_count
            FROM traffic_volumes
            WHERE segment_id IS NOT NULL
            GROUP BY segment_id, hour_of_day, day_of_week;
            
            CREATE INDEX avg_traffic_segment_idx ON avg_traffic_by_segment(segment_id);
            CREATE INDEX avg_traffic_time_idx ON avg_traffic_by_segment(hour_of_day, day_of_week);
        """)
        
        # Add traffic factor to edges
        cur.execute("""
            ALTER TABLE edges 
            ADD COLUMN IF NOT EXISTS traffic_factor FLOAT DEFAULT 1.0;
            
            ALTER TABLE edges 
            ADD COLUMN IF NOT EXISTS segmentid BIGINT;
            
            -- Extract segmentid from join_id
            UPDATE edges 
            SET segmentid = NULLIF(REGEXP_REPLACE(join_id, '^.*?([0-9]+).*$', '\\1'), '')::BIGINT
            WHERE join_id ~ '.*[0-9]+.*';
            
            CREATE INDEX IF NOT EXISTS edges_segmentid_idx ON edges(segmentid);
        """)
        
        # Check if we have any segment ID matches
        cur.execute("""
            SELECT COUNT(*) FROM edges e 
            JOIN traffic_volumes tv ON e.segmentid = tv.segment_id
            WHERE e.segmentid IS NOT NULL AND tv.segment_id IS NOT NULL;
        """)
        segment_match_count = cur.fetchone()[0]
        logger.info(f"Found {segment_match_count} direct segment ID matches between edges and traffic data")
        
        # We'll use spatial matching as a fallback if few direct matches
        if segment_match_count < 100:
            logger.info("Using spatial matching to link traffic data to road segments")
            
            # Create spatial index on traffic volumes location
            cur.execute("""
                CREATE INDEX IF NOT EXISTS traffic_volumes_location_idx 
                ON traffic_volumes USING GIST(location);
            """)
            
            # Match traffic measurements to nearby edges
            cur.execute("""
                -- Create a table to link traffic volumes to the closest edges
                DROP TABLE IF EXISTS traffic_edge_mapping;
                CREATE TABLE traffic_edge_mapping AS
                SELECT DISTINCT ON (tv.id) 
                    tv.id AS traffic_volume_id,
                    e.id AS edge_id,
                    tv.segment_id,
                    e.segmentid AS edge_segmentid,
                    tv.street AS traffic_street,
                    e.street AS edge_street,
                    ST_Distance(tv.location, e.the_geom) AS distance
                FROM 
                    traffic_volumes tv
                JOIN 
                    edges e ON ST_DWithin(tv.location, e.the_geom, 100)  -- Match within 100 units
                WHERE 
                    tv.volume > 0 AND
                    UPPER(tv.street) = UPPER(e.street)  -- Same street name
                ORDER BY 
                    tv.id, ST_Distance(tv.location, e.the_geom);
                    
                CREATE INDEX traffic_edge_mapping_edge_idx ON traffic_edge_mapping(edge_id);
            """)
            
            # Create aggregated traffic stats by edge
            cur.execute("""
                -- Create aggregated traffic stats by edge
                DROP TABLE IF EXISTS edge_traffic_stats;
                CREATE TABLE edge_traffic_stats AS
                SELECT 
                    tem.edge_id,
                    AVG(tv.volume) AS avg_volume,
                    MAX(tv.volume) AS max_volume,
                    COUNT(*) AS sample_count
                FROM 
                    traffic_edge_mapping tem
                JOIN 
                    traffic_volumes tv ON tem.traffic_volume_id = tv.id
                GROUP BY 
                    tem.edge_id;
                    
                CREATE INDEX edge_traffic_stats_idx ON edge_traffic_stats(edge_id);
            """)
            
            # Create traffic factors from the spatially matched data
            cur.execute("""
                -- Get global maximum
                WITH max_stats AS (
                    SELECT MAX(max_volume) AS global_max_volume,
                           AVG(avg_volume) AS global_avg_volume,
                           PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY avg_volume) AS p90_volume
                    FROM edge_traffic_stats
                )
                -- Update traffic factors
                UPDATE edges e
                SET traffic_factor = CASE 
                    WHEN s.avg_volume IS NULL THEN 1.0  -- No data
                    WHEN s.avg_volume > (SELECT p90_volume FROM max_stats) THEN 3.0  -- Very heavy (top 10%)
                    WHEN s.avg_volume > (SELECT global_avg_volume * 1.5 FROM max_stats) THEN 2.0   -- Heavy
                    WHEN s.avg_volume > (SELECT global_avg_volume FROM max_stats) THEN 1.5  -- Medium
                    WHEN s.avg_volume > 0 THEN 1.2  -- Light
                    ELSE 1.0  -- No data
                END
                FROM edge_traffic_stats s
                WHERE e.id = s.edge_id;
            """)
            
        else:
            # Use the standard segment ID matching if we have enough matches
            # Create mapping table
            cur.execute("""
                CREATE TEMP TABLE segment_traffic AS
                SELECT 
                    e.id AS edge_id,
                    e.segmentid,
                    COALESCE(AVG(t.avg_volume), 0) AS avg_volume,
                    COALESCE(MAX(t.max_volume), 0) AS max_volume
                FROM 
                    edges e
                LEFT JOIN 
                    avg_traffic_by_segment t ON e.segmentid = t.segment_id
                WHERE 
                    e.segmentid IS NOT NULL
                GROUP BY
                    e.id, e.segmentid;
                    
                -- Get global maximum
                WITH max_stats AS (
                    SELECT MAX(max_volume) AS global_max_volume FROM segment_traffic
                )
                -- Update traffic factors
                UPDATE edges e
                SET traffic_factor = CASE 
                    WHEN s.avg_volume = 0 THEN 1.0  -- No data
                    WHEN s.avg_volume > (SELECT global_max_volume * 0.75 FROM max_stats) THEN 3.0  -- Very heavy
                    WHEN s.avg_volume > (SELECT global_max_volume * 0.5 FROM max_stats) THEN 2.0   -- Heavy
                    WHEN s.avg_volume > (SELECT global_max_volume * 0.25 FROM max_stats) THEN 1.5  -- Medium
                    WHEN s.avg_volume > 0 THEN 1.2  -- Light
                    ELSE 1.0  -- No data
                END
                FROM segment_traffic s
                WHERE e.id = s.edge_id;
            """)
        
        # Log statistics
        cur.execute("""
            SELECT 
                MIN(traffic_factor) AS min_factor,
                MAX(traffic_factor) AS max_factor,
                AVG(traffic_factor) AS avg_factor,
                COUNT(*) AS total_edges,
                SUM(CASE WHEN traffic_factor > 1.0 THEN 1 ELSE 0 END) AS affected_edges
            FROM edges
            WHERE traffic_factor IS NOT NULL;
        """)
        stats = cur.fetchone()
        
        logger.info(f"Traffic factors applied to {stats[4]} out of {stats[3]} edges")
        return True
    except Exception as e:
        logger.error(f"Error processing traffic data: {e}")
        raise # Re-raise the exception for the caller to handle

def create_traffic_routing_functions(cur, conn):
    """Create traffic-aware routing functions. Relies on caller-managed transaction."""
    logger.info("Creating traffic-based routing functions...")

    cur.execute("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'traffic_factor');")
    if not cur.fetchone()[0]:
        logger.warning("No traffic factor column found - skipping traffic routing functions. This might cause an error if other parts expect these functions.")
        # If the column doesn't exist, the CREATE FUNCTION below will likely fail, 
        # which will be caught by the calling transaction block.
        # Returning True here to allow the script to proceed and potentially fail at function creation if traffic features are critical.
        return True 

    # Get the driving speed from CONFIG
    drive_speed_mph = float(CONFIG['speeds'].get('drive_mph', 25.0))
    logger.info(f"Using driving speed of {drive_speed_mph} mph for traffic routing functions")

    sql_query = f"""
        DROP FUNCTION IF EXISTS getdrivingroute_current_traffic(double precision, double precision, double precision, double precision);
        
        CREATE FUNCTION getdrivingroute_current_traffic(
            _start_lon FLOAT, _start_lat FLOAT, 
            _end_lon FLOAT, _end_lat FLOAT)
        RETURNS TABLE(
            seq INT,
            edge_id BIGINT,         
            join_id VARCHAR,
            street VARCHAR,
            travel_time NUMERIC(10,2), 
            distance NUMERIC(10,2),    
            traffic_factor NUMERIC(10,2), 
            turn_instruction TEXT,
            geom GEOMETRY
        ) AS
        $func$
        DECLARE
            current_hour INTEGER;
            current_day INTEGER;
        BEGIN
            SELECT EXTRACT(HOUR FROM NOW()) INTO current_hour;
            SELECT EXTRACT(DOW FROM NOW()) + 1 INTO current_day; -- Ensure DOW is 1-7 (Mon-Sun) if NOW() DOW is 0-6
            
            RETURN QUERY
            SELECT r.seq, r.edge_id, r.join_id, r.street, 
                   r.travel_time, 
                   r.distance,    
                   r.traffic_factor, 
                   r.turn_instruction,
                   r.geom 
            FROM getdrivingroute_with_traffic(
                _start_lon, _start_lat, _end_lon, _end_lat,
                current_hour, current_day
            ) r;
        END
        $func$ LANGUAGE plpgsql;
    """
    
    cur.execute(sql_query)
    # No commit here
    logger.info("Successfully created traffic-based routing functions")
    return True


def create_mode_specific_tables(cur, conn):
    """Create mode-specific tables. Assumes it's within a caller-managed transaction."""
    logger.info("Creating mode-specific edge tables (driving, biking, walking)...")
    
    # Driving
    logger.info("Creating edges_driving table...")
    cur.execute("DROP TABLE IF EXISTS edges_driving CASCADE;")
    cur.execute("""
        CREATE TABLE edges_driving AS
        SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost, x1, y1, x2, y2
        FROM edges
        WHERE driveable = TRUE AND source IS NOT NULL AND target IS NOT NULL
          AND cost_drive IS NOT NULL AND cost_drive > 0
          AND rcost_drive IS NOT NULL AND rcost_drive > 0;
    """)
    
    # Create optimized indexes for driving
    logger.info("Creating optimized indexes for edges_driving...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_driving_source ON edges_driving(source);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_driving_target ON edges_driving(target);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_driving_source_target_cost ON edges_driving(source, target, cost);")
    cur.execute("ANALYZE edges_driving;")
    cur.execute("CLUSTER VERBOSE edges_driving USING idx_edges_driving_source;")
    cur.execute("ANALYZE edges_driving;")
    logger.info("edges_driving table created with optimized indexes and clustering.")

    # Biking
    logger.info("Creating edges_biking table...")
    cur.execute("DROP TABLE IF EXISTS edges_biking CASCADE;")
    cur.execute("""
        CREATE TABLE edges_biking AS
        SELECT id, source, target, cost_bike AS cost, rcost_bike AS reverse_cost, x1, y1, x2, y2
        FROM edges
        WHERE bikeable = TRUE AND source IS NOT NULL AND target IS NOT NULL
          AND cost_bike IS NOT NULL AND cost_bike > 0
          AND rcost_bike IS NOT NULL AND rcost_bike > 0;
    """)
    
    # Create optimized indexes for biking
    logger.info("Creating optimized indexes for edges_biking...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_biking_source ON edges_biking(source);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_biking_target ON edges_biking(target);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_biking_source_target_cost ON edges_biking(source, target, cost);")
    cur.execute("ANALYZE edges_biking;")
    cur.execute("CLUSTER VERBOSE edges_biking USING idx_edges_biking_source;")
    cur.execute("ANALYZE edges_biking;")
    logger.info("edges_biking table created with optimized indexes and clustering.")

    # Walking
    logger.info("Creating edges_walking table...")
    cur.execute("DROP TABLE IF EXISTS edges_walking CASCADE;")
    cur.execute("""
        CREATE TABLE edges_walking AS
        SELECT 
            id, 
            source, 
            target, 
            cost_walk AS cost, 
            rcost_walk AS reverse_cost,
            x1, y1, x2, y2,
            ST_SetSRID(ST_MakePoint(x1, y1), 2263) AS start_pt,
            ST_SetSRID(ST_MakePoint(x2, y2), 2263) AS end_pt
        FROM edges
        WHERE walkable = TRUE AND source IS NOT NULL AND target IS NOT NULL
          AND cost_walk IS NOT NULL AND cost_walk > 0
          AND rcost_walk IS NOT NULL AND rcost_walk > 0;
    """)
    
    # Create optimized indexes for walking
    logger.info("Creating optimized indexes for edges_walking...")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_walking_source ON edges_walking(source);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_walking_target ON edges_walking(target);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_walking_source_target_cost ON edges_walking(source, target, cost);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_walking_start_pt ON edges_walking USING GIST (start_pt);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_edges_walking_end_pt ON edges_walking USING GIST (end_pt);")
    cur.execute("ANALYZE edges_walking;")
    cur.execute("CLUSTER VERBOSE edges_walking USING idx_edges_walking_source;")
    cur.execute("ANALYZE edges_walking;")
    logger.info("edges_walking table created with optimized indexes and clustering.")
    
    return True

# Helper function to process a single quadrant - defined at module level to be accessible
def build_quadrant_ch(mode, q, bounds_data, conn_params):
    """Process CH for a single quadrant and mode."""
    try:
        with psycopg.connect(**conn_params) as local_conn:
            with local_conn.cursor() as local_cur:
                # Set moderate work_mem for this connection too
                local_cur.execute("SET work_mem = '1GB';")
                # Disable synchronous_commit for better bulk load performance
                local_cur.execute("SET synchronous_commit = OFF;")
                
                min_lon, min_lat, max_lon, max_lat, mid_lon, mid_lat, buffer_size = bounds_data
                
                # Define quadrant bounds with buffer
                if q == 0:  # NW
                    lon_min, lon_max = min_lon, mid_lon + buffer_size
                    lat_min, lat_max = mid_lat - buffer_size, max_lat
                    quadrant_name = "Northwest"
                elif q == 1:  # NE
                    lon_min, lon_max = mid_lon - buffer_size, max_lon
                    lat_min, lat_max = mid_lat - buffer_size, max_lat
                    quadrant_name = "Northeast"
                elif q == 2:  # SW
                    lon_min, lon_max = min_lon, mid_lon + buffer_size
                    lat_min, lat_max = min_lat, mid_lat + buffer_size
                    quadrant_name = "Southwest"
                else:  # SE
                    lon_min, lon_max = mid_lon - buffer_size, max_lon
                    lat_min, lat_max = min_lat, mid_lat + buffer_size
                    quadrant_name = "Southeast"
                
                logger.info(f"Processing {mode} {quadrant_name} quadrant (#{q+1}) with buffer...")
                
                # TRUNCATE instead of DROP/CREATE
                local_cur.execute(f"TRUNCATE TABLE edges_{mode}_quadrant_{q};")
                
                # Use direct numeric comparison instead of ST_Within for better performance
                local_cur.execute(f"""
                    INSERT INTO edges_{mode}_quadrant_{q}
                    SELECT id, source, target, cost, reverse_cost, x1, y1, x2, y2
                    FROM edges_{mode}
                    WHERE x1 BETWEEN {lon_min} AND {lon_max}
                      AND y1 BETWEEN {lat_min} AND {lat_max};
                """)
                
                # Analyze the quadrant table
                local_cur.execute(f"ANALYZE edges_{mode}_quadrant_{q};")
                
                # Get count of edges in this quadrant
                local_cur.execute(f"SELECT COUNT(*) FROM edges_{mode}_quadrant_{q};")
                edge_count = local_cur.fetchone()[0]
                logger.info(f"Quadrant {q+1} for {mode} contains {edge_count} edges")
                
                # Skip processing if quadrant is empty to avoid errors
                if edge_count == 0:
                    logger.warning(f"Skipping {mode} quadrant {q+1} - no edges in this quadrant")
                    return True
                
                # TRUNCATE the CH output table
                local_cur.execute(f"TRUNCATE TABLE edges_{mode}_ch_quadrant_{q};")
                
                # Run CH and store in the temporary output table
                logger.info(f"Running CH on {mode} quadrant {q+1}...")
                local_cur.execute(f"""
                    INSERT INTO edges_{mode}_ch_quadrant_{q}
                    SELECT *
                    FROM pgr_contractionHierarchies(
                        'SELECT id, source, target, cost, reverse_cost 
                        FROM edges_{mode}_quadrant_{q}',
                        forbidden => ARRAY[]::bigint[],
                        directed => TRUE
                    );
                """)
                
                # Get count of CH result rows
                local_cur.execute(f"SELECT COUNT(*) FROM edges_{mode}_ch_quadrant_{q};")
                ch_count = local_cur.fetchone()[0]
                logger.info(f"Generated {ch_count} CH edges for {mode} quadrant {q+1}")
                
                # Insert directly to the main CH table with ON CONFLICT to avoid duplicates
                local_cur.execute(f"""
                    INSERT INTO edges_{mode}_ch
                    SELECT * FROM edges_{mode}_ch_quadrant_{q}
                    ON CONFLICT (id) DO NOTHING;
                """)
                
                # Reset work_mem and synchronous_commit for this connection
                local_cur.execute("SET work_mem = '128MB';")
                local_cur.execute("SET synchronous_commit = ON;")
                
                logger.info(f"Completed {mode} quadrant {q+1} ({quadrant_name}) CH preparation")
                return True
    except Exception as e:
        logger.error(f"Error processing {mode} quadrant {q+1}: {e}")
        raise

def prepare_contraction_hierarchies(cur, conn):
    """Prepare Contraction Hierarchies for driving and biking networks by processing in quadrants."""
    logger.info("Preparing Contraction Hierarchies for faster routing...")
    
    # Set reasonable work_mem instead of oversized value
    logger.info("Setting work_mem to 1GB for CH preparation...")
    cur.execute("SET work_mem = '1GB';")
    
    # Disable synchronous_commit for better bulk load performance
    logger.info("Temporarily disabling synchronous_commit for better performance...")
    cur.execute("SET synchronous_commit = OFF;")
    
    try:
        # Get network bounds
        cur.execute("""
            SELECT 
                ST_XMin(ST_Extent(the_geom_4326)) as min_lon,
                ST_YMin(ST_Extent(the_geom_4326)) as min_lat,
                ST_XMax(ST_Extent(the_geom_4326)) as max_lon,
                ST_YMax(ST_Extent(the_geom_4326)) as max_lat
            FROM edges;
        """)
        bounds = cur.fetchone()
        min_lon, min_lat, max_lon, max_lat = bounds
        
        # Calculate quadrant boundaries
        mid_lon = (min_lon + max_lon) / 2
        mid_lat = (min_lat + max_lat) / 2
        
        # Define buffer to ensure overlap at tile boundaries (approximately 100m in degrees)
        buffer_size = 0.001  # ~100m in degrees
        
        # Create base UNLOGGED tables for CH and quadrants (once, then TRUNCATE) for each mode
        for mode in ['driving', 'biking']:
            logger.info(f"Creating UNLOGGED base tables for {mode} CH processing...")
            
            # Create UNLOGGED base table for this mode's CH result
            cur.execute(f"""
                DROP TABLE IF EXISTS edges_{mode}_ch;
                CREATE UNLOGGED TABLE edges_{mode}_ch (
                    id BIGINT,
                    source BIGINT,
                    target BIGINT,
                    cost FLOAT,
                    reverse_cost FLOAT,
                    contracted_vertices BIGINT[],
                    contracted_edges BIGINT[]
                );
                
                -- Add PRIMARY KEY to enable ON CONFLICT optimization
                ALTER TABLE edges_{mode}_ch ADD PRIMARY KEY (id);
            """)
            
            # Create template tables for quadrants that will be reused with TRUNCATE
            for q in range(4):
                # Main quadrant data table
                cur.execute(f"""
                    DROP TABLE IF EXISTS edges_{mode}_quadrant_{q};
                    CREATE UNLOGGED TABLE edges_{mode}_quadrant_{q} (
                        id BIGINT,
                        source BIGINT,
                        target BIGINT,
                        cost FLOAT,
                        reverse_cost FLOAT,
                        x1 FLOAT,
                        y1 FLOAT,
                        x2 FLOAT,
                        y2 FLOAT
                    );
                    
                    -- Add B-tree index on x1, y1 for faster filtering
                    CREATE INDEX idx_edges_{mode}_quadrant_{q}_x1_y1 
                    ON edges_{mode}_quadrant_{q}(x1, y1);
                    
                    CREATE INDEX idx_edges_{mode}_quadrant_{q}_source 
                    ON edges_{mode}_quadrant_{q}(source);
                    
                    CREATE INDEX idx_edges_{mode}_quadrant_{q}_target 
                    ON edges_{mode}_quadrant_{q}(target);
                """)
                
                # CH results table
                cur.execute(f"""
                    DROP TABLE IF EXISTS edges_{mode}_ch_quadrant_{q};
                    CREATE UNLOGGED TABLE edges_{mode}_ch_quadrant_{q} (
                        id BIGINT,
                        source BIGINT,
                        target BIGINT,
                        cost FLOAT,
                        reverse_cost FLOAT,
                        contracted_vertices BIGINT[],
                        contracted_edges BIGINT[]
                    );
                """)
        
        # Process each mode sequentially
        for mode in ['driving', 'biking']:
            logger.info(f"Processing {mode} network in quadrants...")
            
            # Prepare bounds data to pass to helper function
            bounds_data = (min_lon, min_lat, max_lon, max_lat, mid_lon, mid_lat, buffer_size)
            
            # Determine optimal max_workers based on CPU cores, but cap at 4 for typical use
            max_workers = min(os.cpu_count() or 4, 4)
            
            # Process quadrants in parallel with appropriate worker count
            logger.info(f"Starting parallel processing of {mode} quadrants with {max_workers} workers...")
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(build_quadrant_ch, mode, q, bounds_data, {
                        'user': os.getenv('POSTGRES_USER'),
                        'host': os.getenv('POSTGRES_HOST'),
                        'dbname': os.getenv('POSTGRES_DB'),
                        'password': os.getenv('POSTGRES_PASSWORD'),
                        'port': os.getenv('POSTGRES_PORT', '5432'),
                        'connect_timeout': 60
                    })
                    for q in range(4)
                ]
                
                # Wait for all futures to complete and check for exceptions
                for future in concurrent.futures.as_completed(futures):
                    try:
                        future.result()  # This will raise any exceptions from the thread
                    except Exception as e:
                        logger.error(f"A quadrant processing task failed: {e}")
                        raise
            
            # Get row count for final CH table
            cur.execute(f"SELECT COUNT(*) FROM edges_{mode}_ch;")
            final_ch_count = cur.fetchone()[0]
            logger.info(f"Final {mode} CH table contains {final_ch_count} edges")
            
            # Verify we have data before creating indexes
            if final_ch_count == 0:
                logger.warning(f"No CH data generated for {mode}. Check if mode-specific tables are properly populated.")
            
            # Create final indexes on combined CH table and analyze
            logger.info(f"Creating indexes on combined {mode} CH table...")
            cur.execute(f"""
                CREATE INDEX idx_edges_{mode}_ch_source ON edges_{mode}_ch(source);
                CREATE INDEX idx_edges_{mode}_ch_target ON edges_{mode}_ch(target);
                ANALYZE edges_{mode}_ch;
            """)
            
            # Convert UNLOGGED table to regular table for durability once processing is complete
            logger.info(f"Converting {mode} CH UNLOGGED table to regular table for durability...")
            cur.execute(f"""
                ALTER TABLE edges_{mode}_ch SET LOGGED;
            """)
            
            # Optional: Cluster only if explicitly needed and system resources allow
            if os.getenv('ENABLE_CH_CLUSTERING', 'false').lower() == 'true':
                logger.info(f"Clustering {mode} CH table by source index (optional, enabled via env var)...")
                cur.execute(f"CLUSTER VERBOSE edges_{mode}_ch USING idx_edges_{mode}_ch_source;")
                cur.execute(f"ANALYZE edges_{mode}_ch;")
            else:
                logger.info(f"Skipping {mode} CH table clustering (can be enabled via ENABLE_CH_CLUSTERING=true)")
            
            logger.info(f"Completed {mode} network CH preparation")
            
            # Clean up UNLOGGED temporary tables for this mode
            for q in range(4):
                cur.execute(f"""
                    DROP TABLE IF EXISTS edges_{mode}_quadrant_{q};
                    DROP TABLE IF EXISTS edges_{mode}_ch_quadrant_{q};
                """)
        
        # Reset work_mem and synchronous_commit to safer defaults
        logger.info("Resetting work_mem to 128MB and enabling synchronous_commit...")
        cur.execute("SET work_mem = '128MB';")
        cur.execute("SET synchronous_commit = ON;")
        
        logger.info("Contraction Hierarchies preparation completed successfully.")
        return True
    except Exception as e:
        # Reset work_mem and synchronous_commit even if there's an error
        try:
            logger.info("Resetting work_mem to 128MB and enabling synchronous_commit after error...")
            cur.execute("SET work_mem = '128MB';")
            cur.execute("SET synchronous_commit = ON;")
        except Exception as reset_error:
            logger.error(f"Error resetting database parameters: {reset_error}")
        
        logger.error(f"Error preparing Contraction Hierarchies: {e}")
        raise

def run_smoke_tests(cur, conn):
    """Run smoke tests. These are read-only, so no explicit transaction needed from here,
       but assumes DB is in a consistent state."""
    logger.info("Running smoke tests...")
    
    # NYC test coordinates
    start_lon, start_lat = -74.003632, 40.710457
    end_lon, end_lat = -74.002496, 40.715477
    
    # Get speed values from CONFIG
    drive_speed_mph = float(CONFIG['speeds'].get('drive_mph', 25.0))
    bike_speed_mph = float(CONFIG['speeds'].get('bike_mph', 12.0))
    walk_speed_mph = float(CONFIG['speeds'].get('walk_mph', 3.0))
    
    logger.info(f"Running smoke tests with speeds: drive={drive_speed_mph} mph, bike={bike_speed_mph} mph, walk={walk_speed_mph} mph")
    
    # Test each routing function
    try:
        logger.info("Testing getdrivingroute function...")
        cur.execute("""
            SELECT COUNT(*) FROM getdrivingroute(%s, %s, %s, %s);
        """, (start_lon, start_lat, end_lon, end_lat))
        count = cur.fetchone()[0]
        logger.info(f"Driving route returned {count} segments")
        
        logger.info("Testing getbikingroute function...")
        cur.execute("""
            SELECT COUNT(*) FROM getbikingroute(%s, %s, %s, %s);
        """, (start_lon, start_lat, end_lon, end_lat))
        count = cur.fetchone()[0]
        logger.info(f"Biking route returned {count} segments")
        
        logger.info("Testing getwalkingroute function...")
        cur.execute("""
            SELECT COUNT(*) FROM getwalkingroute(%s, %s, %s, %s);
        """, (start_lon, start_lat, end_lon, end_lat))
        count = cur.fetchone()[0]
        logger.info(f"Walking route returned {count} segments")
        
        # Test a more detailed sample with actual route data
        logger.info("Testing detailed route data from getdrivingroute...")
        cur.execute("""
            SELECT seq, edge_id::BIGINT, street, travel_time, distance, turn_instruction, ST_AsText(geom)
            FROM getdrivingroute(%s, %s, %s, %s)
            LIMIT 5;
        """, (start_lon, start_lat, end_lon, end_lat))
        
        rows = cur.fetchall()
        for row in rows:
            logger.info(f"Route segment: seq={row[0]}, edge_id={row[1]}, street='{row[2]}', " +
                       f"time={row[3]:.2f}s, dist={row[4]:.2f}ft, instruction='{row[5]}'")
        
        logger.info("Smoke tests completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during smoke tests: {e}")
        logger.error("Smoke tests failed - this may indicate issues with the routing network")
        return False


def find_turn_restrictions(cur, conn, dir_path):
    """Ensures turn restrictions are set up and analyzed. 
       Actual creation and population logic is primarily in create_edges_table.
       Assumes it's within a caller-managed transaction.
    """
    logger.info("Finalizing turn restrictions setup (analysis)...")
    try:
        # The restrictions table (if applicable based on data) and initial population 
        # are handled in create_edges_table.
        # This function ensures it's analyzed if it exists.
        
        # cur.execute("SELECT to_regclass('public.restrictions');") # Removed as restrictions table is not created
        # table_exists = cur.fetchone() # Removed
        
        # if table_exists and table_exists[0]: # Removed
        #     logger.info("Restrictions table found. Analyzing restrictions table...") # Removed
        #     cur.execute("ANALYZE restrictions;") # Removed
        #     logger.info("Turn restrictions analysis complete.") # Removed
        # else: # Removed
        #     logger.info("Restrictions table not found or not applicable (e.g., no grade separations). Skipping analysis.") # Removed
            
        logger.info("Turn restrictions are out of scope for MVP. Skipping analysis.")
        return True
    except Exception as e:
        logger.error(f"Error during find_turn_restrictions (analysis): {e}")
        # conn.rollback() # Caller manages transaction
        raise # Re-raise to indicate failure


def main():
    start_time = datetime.now()
    dir_path = os.path.dirname(os.path.realpath(__file__))
    sql_scripts_dir = os.path.join(dir_path, 'sql') # New base path for SQL scripts
    
    user = os.getenv('POSTGRES_USER')
    password = os.getenv('POSTGRES_PASSWORD')
    database = os.getenv('POSTGRES_DB')
    host = os.getenv('POSTGRES_HOST')
    port = os.getenv('POSTGRES_PORT', '5432')
    # traffic_data_file_path = os.getenv('TRAFFIC_DATA_FILE') # MVP: Traffic data processing commented out
    
    logger.info(f"Starting network creation process (MVP focus)")

    try:
        connect_params = {
            'user': user,
            'host': host,
            'dbname': database,
            'password': password,
            'port': port,
            'connect_timeout': 60
        }
        
        with psycopg.connect(**connect_params) as conn:
            with conn.cursor() as cur:
                
                # Phase 0: Initial Extensions
                logger.info("Phase 0: Ensuring PostGIS and pgRouting extensions are enabled...")
                try:
                    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
                    cur.execute("CREATE EXTENSION IF NOT EXISTS pgrouting;")
                    conn.commit() 
                    logger.info("Extensions checked/created.")
                except Exception as e:
                    logger.error(f"Failed to create extensions: {e}")
                    conn.rollback() 
                    raise

                logger.info("Checking pgRouting version and updating if necessary...")
                cur.execute("SELECT installed_version FROM pg_available_extensions WHERE name = 'pgrouting';")
                installed_version_row = cur.fetchone()
                if installed_version_row and installed_version_row[0] and installed_version_row[0] < '3.8.0':
                    logger.info(f"Updating pgRouting from {installed_version_row[0]} to 3.8.0 (or latest available patch of 3.8)...")
                    cur.execute("ALTER EXTENSION pgrouting UPDATE TO '3.8.0';") # Or specific patch if needed
                    conn.commit()
                    logger.info("pgRouting updated.")
                elif installed_version_row and installed_version_row[0] >= '3.8.0':
                     logger.info(f"pgRouting version {installed_version_row[0]} is already 3.8.0 or newer.")
                else:
                    logger.warning("Could not determine installed pgRouting version or extension not installed. Update check skipped.")


                # Phase 1: Core Network Structure (Edges, Travel Times, Topology, Costs)
                logger.info("Phase 1: Building Core Network Structure (MVP)")

                # Phase 1.1: Edges Table Creation (01_edges.sql)
                logger.info("Phase 1.1: Edges Table Creation (executing 01_edges.sql & Python post-processing)...")
                try:
                    with conn.transaction():
                        create_edges_table(cur, conn, os.path.join(sql_scripts_dir, "01_edges.sql"))
                    logger.info("Phase 1.1 (Edges Table Creation) committed.")
                except Exception as e:
                    logger.error(f"Error in Phase 1.1 (Edges Table Creation): {e}")
                    raise

                # Phase 1.2: Travel Time Calculation (02_travel_time.sql)
                logger.info("Phase 1.2: Travel Time Calculation (executing 02_travel_time.sql & Python post-processing)...")
                try:
                    with conn.transaction():
                        calculate_travel_times(cur, conn, os.path.join(sql_scripts_dir, "02_travel_time.sql"))
                    logger.info("Phase 1.2 (Travel Times) committed.")
                except Exception as e:
                    logger.error(f"Error in Phase 1.2 (Travel Times): {e}")
                    raise
                
                # Phase 1.3: Topology Creation (03_topology.sql)
                logger.info("Phase 1.3: Topology Creation (executing 03_topology.sql & Python post-processing)...")
                try:
                    with conn.transaction():
                        create_topology(cur, conn, os.path.join(sql_scripts_dir, "03_topology.sql"), connect_params)
                    logger.info("Phase 1.3 (Topology Creation) committed.")
                except Exception as e:
                    logger.error(f"Error in Phase 1.3 (Topology Creation): {e}")
                    raise

                # Phase 1.4: Cost Assignment (04_cost.sql)
                logger.info("Phase 1.4: Cost Assignment (executing 04_cost.sql & Python post-processing)...")
                try:
                    with conn.transaction():
                        logger.info("Applying costs from 04_cost.sql...")
                        execute_sql_file(cur, conn, os.path.join(sql_scripts_dir, "04_cost.sql"))
                        
                        logger.info("Analyzing edges table after setting costs (indexes created in SQL)...")
                        cur.execute("ANALYZE edges;")
                    logger.info("Phase 1.4 (Costs) committed.")
                except Exception as e:
                    logger.error(f"Error in Phase 1.4 (Costs): {e}")
                    raise

                # Phase 2: Creating Mode-Specific Tables and Contraction Hierarchies (CH) -- SKIPPED FOR MVP
                logger.info("Phase 2: Mode-Specific Tables and CH -- SKIPPED FOR MVP")
                # try:
                #     with conn.transaction():
                #         if not create_mode_specific_tables(cur, conn):
                #             raise Exception("Failed to create mode-specific tables.")
                #     logger.info("Phase 2.1: Mode-Specific Tables transaction committed.")
                # except Exception as e:
                #     logger.error(f"Error in Phase 2.1 (Mode-Specific Tables): {e}")
                #     logger.info("Phase 2.1: Mode-Specific Tables transaction rolled back due to error.")
                #     raise
                # 
                # try:
                #     prepare_contraction_hierarchies(cur, conn)
                #     logger.info("Phase 2.2 CH Preparation completed.") 
                # except Exception as e:
                #     logger.error(f"Error in Phase 2.2 (CH Preparation): {e}")
                #     raise

                # Phase 3: SQL Functions (05_functions.sql)
                logger.info("Phase 3: Setting up SQL Functions (executing 05_functions.sql)...")
                try:
                    with conn.transaction():
                        # find_turn_restrictions call removed for MVP 
                        logger.info("Turn restrictions processing skipped for MVP.")
                        create_functions(cur, conn, os.path.join(sql_scripts_dir, "05_functions.sql"))
                    logger.info("Phase 3 (SQL Functions) committed.")
                    # Run smoke tests immediately after functions are created
                    logger.info("Running smoke tests after function creation...")
                    run_smoke_tests(cur, conn) # This will raise an exception if tests fail
                    logger.info("Smoke tests passed.")
                except Exception as e:
                    logger.error(f"Error in Phase 3 (SQL Functions) or subsequent smoke tests: {e}")
                    raise
                
                # Phase 4: Traffic Data Processing -- SKIPPED FOR MVP
                logger.info("Phase 4: Traffic Data Processing skipped for MVP.")
                # The original script had extensive traffic processing logic here.
                # For MVP, this is all skipped.

                # Phase 5: Final Maintenance
                logger.info("Phase 5: Performing final analysis of key tables...")
                try:
                    with conn.transaction():
                        cur.execute("ANALYZE edges;")
                        cur.execute("ANALYZE edges_vertices_pgr;")
                    logger.info("Phase 5: Final analysis committed.")
                except Exception as e:
                    logger.error(f"Error during final analysis: {e}")
                    # Not raising here to allow smoke tests if analysis fails
                
                # Run smoke tests (read-only) -- This call is now moved up after Phase 3
                # run_smoke_tests(cur, conn)

    except psycopg.Error as db_err:
        logger.error(f"Database connection or operational error: {db_err}")
        if hasattr(db_err, 'diag') and db_err.diag:
            diag_parts = [f"PG Diag: {db_err.diag.message_primary}"]
            if hasattr(db_err.diag, 'message_detail') and db_err.diag.message_detail:
                diag_parts.append(f"Detail: {db_err.diag.message_detail}")
            if hasattr(db_err.diag, 'message_hint') and db_err.diag.message_hint:
                diag_parts.append(f"Hint: {db_err.diag.message_hint}")
            logger.error(" - ".join(diag_parts))
    except Exception as e:
        logger.error(f"An unexpected error occurred in main: {e}")

    delta = datetime.now() - start_time
    logger.info(f"Finished in {delta}")


if __name__ == '__main__':
    main()
````

## File: data-importer/scripts/import-lion.sh
````bash
#!/bin/bash
set -e

TRAFFIC_DATA_URL="https://data.cityofnewyork.us/api/views/7ym2-wayt/rows.csv"
TRAFFIC_DATA_PATH="/data-imports/data/traffic_data.csv"

print_usage() {
  echo "Usage: $0 [LION_VERSION] [OPTIONS]"
  echo "Options:"
  echo "  --download-traffic  Download latest traffic volume data from NYC Open Data"
  echo "  --traffic-file PATH  Use local traffic data file at PATH"
  echo ""
  echo "Examples:"
  echo "  $0 23a                            # Import LION 23a without traffic data"
  echo "  $0 23a --download-traffic         # Import LION 23a and download traffic data"
  echo "  $0 23a --traffic-file data.csv    # Import LION 23a with local traffic data"
}

# Parse arguments
if [ "$#" -eq "0" ]; then
  LION=$DEFAULT_LION
  TRAFFIC_DATA=""
  DOWNLOAD_TRAFFIC=false
else
  LION=$1
  shift

  # Process additional arguments
  TRAFFIC_DATA=""
  DOWNLOAD_TRAFFIC=false
  
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --download-traffic)
        DOWNLOAD_TRAFFIC=true
        TRAFFIC_DATA="$TRAFFIC_DATA_PATH"
        shift
        ;;
      --traffic-file)
        if [ "$#" -gt 1 ]; then
          TRAFFIC_DATA="$2"
          shift 2
        else
          echo "Error: Missing path for --traffic-file"
          print_usage
          exit 1
        fi
        ;;
      --help)
        print_usage
        exit 0
        ;;
      *)
        echo "Error: Unknown option: $1"
        print_usage
        exit 1
        ;;
    esac
  done
fi

echo "Attempting to import LION $LION"

# Handle traffic data
if [ "$DOWNLOAD_TRAFFIC" = true ]; then
  # Check if traffic data file already exists
  if [ -f "$TRAFFIC_DATA" ]; then
    echo "Traffic data file already exists at $TRAFFIC_DATA"
    echo "Using existing traffic data file"
  else
    echo "Downloading traffic data from NYC Open Data..."
    mkdir -p "$(dirname "$TRAFFIC_DATA")"
    curl -o "$TRAFFIC_DATA" "$TRAFFIC_DATA_URL"
    if [ $? -ne 0 ]; then
      echo "Error downloading traffic data"
      TRAFFIC_DATA=""
    else
      echo "Traffic data downloaded to $TRAFFIC_DATA"
    fi
  fi
elif [ -n "$TRAFFIC_DATA" ]; then
  echo "Using traffic data from $TRAFFIC_DATA"
  if [ ! -f "$TRAFFIC_DATA" ]; then
    echo "Warning: Traffic data file not found at $TRAFFIC_DATA"
    TRAFFIC_DATA=""
  fi
fi

#================================
# Download Lion
#================================
# only download if directory doesnt exists
if [ ! -d "/data-imports/data/lion_${LION}" ]; then
  echo "Downloading LION data version $LION..."
  mkdir -p "/data-imports/data/lion_${LION}"
  # example url: https://s-media.nyc.gov/agencies/dcp/assets/files/zip/data-tools/bytes/nyclion_23a.zip
  curl -o /data-imports/data/lion_"${LION}"/lion.zip https://s-media.nyc.gov/agencies/dcp/assets/files/zip/data-tools/bytes/nyclion_"${LION}".zip &&
    unzip /data-imports/data/lion_"${LION}"/lion.zip -d /data-imports/data/lion_"${LION}" &&
    rm /data-imports/data//lion_"${LION}"/lion.zip
fi

## ================================
## load Lion data with ogr2ogr
## ================================
# ./scripts/wait-for-it.sh "$POSTGRES_HOST":5432 -- echo "database is up"

# need to create extensions on first go
psql --command="create extension if not exists postgis;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB
psql --command="create extension if not exists pgrouting;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB

CNX="user=$POSTGRES_USER host=$POSTGRES_HOST dbname=$POSTGRES_DB password=$POSTGRES_PASSWORD port=5432"
GDB=/data-imports/data/lion_${LION}/lion/lion.gdb
# load only required fields
FIELDS="segmentid,join_id,street,trafdir,nodelevelf,nodelevelt,posted_speed,number_travel_lanes,featuretyp,bikelane,bike_trafdir,nonped,segmenttyp,segmentid,rw_type"
echo "Importing lion data..."
ogr2ogr -progress \
  --config PG_USE_COPY YES \
  -lco GEOMETRY_NAME=the_geom \
  -overwrite \
  -select $FIELDS \
  -f 'PostgreSQL' PG:"$CNX" \
  -nlt CONVERT_TO_LINEAR "$GDB" "lion"

## ================================
## create routing network
## ================================
# Export traffic data path if provided
if [ -n "$TRAFFIC_DATA" ]; then
  echo "Setting TRAFFIC_DATA_FILE environment variable to: $TRAFFIC_DATA"
  export TRAFFIC_DATA_FILE="$TRAFFIC_DATA"
fi

echo "Running create_network.py..."
python3 /data-imports/scripts/create_network.py

# Cleanup env var
if [ -n "$TRAFFIC_DATA" ]; then
  unset TRAFFIC_DATA_FILE
fi

# Only clean up downloaded traffic data if we downloaded it in this run and it didn't exist before
if [ "$DOWNLOAD_TRAFFIC" = true ] && [ ! -f "$TRAFFIC_DATA_PATH" ]; then
  rm -f "$TRAFFIC_DATA"
  echo "Temporary traffic data file removed"
fi
````

import os
import string
import logging
from datetime import datetime
import psycopg
import concurrent.futures
from tqdm import tqdm 
import csv

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
    'tolerance': 0.0003,
    'topology_batch_size': 5000,  # Reduced batch size for better stability
    'speeds': {
        'walk_mph': 3,  # Average walking speed in mph
        'bike_mph': 12,  # Average biking speed in mph
        'ferry_mph': 25  # Average ferry speed in mph
    }
}

def execute_sql_file(cur, conn, file_path, params=None):
    """Helper function to execute SQL from files with better error reporting"""
    try:
        with open(file_path, 'r') as file:
            sql = file.read()
        
        # For files with dollar-quoted strings, execute the whole file at once
        if "$func$" in sql:
            logger.info(f"Executing SQL file with dollar quotes: {os.path.basename(file_path)}")
            cur.execute(sql)
            conn.commit()
            return True
            
        # For regular SQL files, split and execute statement by statement
        else:
            # Split the SQL file into individual statements
            statements = sql.split(';')
            
            for statement in statements:
                if statement.strip():
                    try:
                        if params:
                            cur.execute(statement, params)
                        else:
                            cur.execute(statement)
                    except Exception as e:
                        # Log the specific statement that failed
                        logger.error(f"Error executing SQL statement: {statement.strip()}")
                        logger.error(f"Error details: {e}")
                        conn.rollback()
                        raise
            
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error executing SQL file {file_path}: {e}")
        conn.rollback()
        return False

def fix_invalid_geometries(cur, conn):
    """Detect and fix invalid geometries in the edges table"""
    logger.info("Checking for invalid geometries...")
    try:
        # Check for invalid geometries
        cur.execute("SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(the_geom);")
        invalid_count = cur.fetchone()[0]
        
        if invalid_count > 0:
            logger.warning(f"Found {invalid_count} invalid geometries, attempting to fix...")
            
            # Fix invalid geometries
            cur.execute("UPDATE edges SET the_geom = ST_MakeValid(the_geom) WHERE NOT ST_IsValid(the_geom);")
            conn.commit()
            
            # Check again
            cur.execute("SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(the_geom);")
            still_invalid = cur.fetchone()[0]
            
            if still_invalid > 0:
                logger.warning(f"After repair, {still_invalid} geometries are still invalid")
            else:
                logger.info("All geometries are now valid")
        else:
            logger.info("All geometries are valid")
            
    except Exception as e:
        logger.error(f"Error checking/fixing geometries: {e}")
        conn.rollback()

def create_edges(cur, conn, dir_path):
    logger.info('Creating edges table...')
    if execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', 'edges.sql')):
        # Check and repair geometries after creating edges
        fix_invalid_geometries(cur, conn)


def calculate_travel_times(cur, conn, dir_path, speeds):
    logger.info('Calculating travel times...')
    try:
        with open(os.path.join(dir_path, 'sql', 'travel_time.sql'), 'r') as file:
            query = file.read()
            
        # Replace hardcoded speeds with parameterized values
        walk_speed_hourly = speeds['walk_mph'] / 60
        bike_speed_hourly = speeds['bike_mph'] / 60
        ferry_speed_hourly = speeds['ferry_mph'] / 60
        
        # Replace hardcoded values in the SQL
        query = query.replace("/ .05", f"/ {walk_speed_hourly}")
        query = query.replace("/ .2", f"/ {bike_speed_hourly}")
        query = query.replace("/ .42", f"/ {ferry_speed_hourly}")
        
        # Split the query into individual statements for better error handling
        statements = query.split(';')
        
        for stmt in statements:
            if stmt.strip():
                try:
                    cur.execute(stmt)
                    conn.commit()
                except Exception as e:
                    logger.error(f"Error in travel_time.sql statement: {stmt.strip()}")
                    logger.error(f"Error details: {e}")
                    conn.rollback()
    except Exception as e:
        logger.error(f"Error calculating travel times: {e}")
        conn.rollback()


def calculate_segment_costs(cur, conn, dir_path):
    logger.info('Calculating segment costs...')
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', 'cost.sql'))



def process_topology_batch(batch_params):
    """
    Worker function to process a single topology batch in a separate process.
    Returns a tuple with (batch_id, success_flag, processed_count, total_count, execution_time).
    Includes execution time to monitor performance.
    """
    start_id, end_id, tolerance, db_params = batch_params
    
    try:
        # Record start time to track performance
        start_time = datetime.now()
        
        # Create a new connection for this process
        with psycopg.connect(**db_params) as conn:
            with conn.cursor() as cur:
                batch_filter = f"id >= {start_id} AND id <= {end_id}"
                
                # Set statement timeout for this batch (5 minutes)
                cur.execute("SET statement_timeout = 300000;")  # 5 minutes in ms
                
                # Use pgr_createTopology with a batch filter
                cur.execute(f"""
                    SELECT pgr_createTopology(
                        'edges', 
                        {tolerance}, 
                        'the_geom', 
                        'id',
                        'source',
                        'target',
                        rows_where:='{batch_filter}'
                    );
                """)
                conn.commit()
                
                # Check progress after batch
                cur.execute(f"SELECT COUNT(*) FROM edges WHERE {batch_filter} AND source IS NOT NULL AND target IS NOT NULL;")
                batch_success_count = cur.fetchone()[0]
                
                cur.execute(f"SELECT COUNT(*) FROM edges WHERE {batch_filter};")
                batch_total = cur.fetchone()[0]
                
                # Calculate execution time
                execution_time = (datetime.now() - start_time).total_seconds()
                
                # Return the results with execution time
                return (start_id, True, batch_success_count, batch_total, execution_time)
    except Exception as e:
        # If there was an error, return failure
        execution_time = (datetime.now() - start_time).total_seconds()
        return (start_id, False, 0, 0, execution_time)

def perform_maintenance(cur, conn):
    """
    Perform database maintenance operations to maintain performance.
    This includes reindexing the vertices table and vacuuming.
    """
    try:
        # Minimal logging during maintenance to avoid interrupting progress bar
        cur.execute("REINDEX INDEX edges_vertices_pgr_idx;")
        cur.execute("ANALYZE edges_vertices_pgr;")
        cur.execute("ANALYZE edges;")
        conn.commit()
        return True
    except Exception as e:
        # Only log errors
        logger.error(f"Error during maintenance: {e}")
        conn.rollback()
        return False

def create_topology(cur, conn, dir_path, batch_size=5000):
    """
    Creates topology using pgr_createTopology with parallel processing.
    Uses small batches processed in parallel for maximum performance.
    Includes performance monitoring and maintenance to prevent slowdowns.
    """
    try:
        # First check if the pgRouting extension is available
        try:
            cur.execute("SELECT postgis_full_version(), pgr_version();")
            versions = cur.fetchone()
            logger.info(f"PostGIS version: {versions[0]}")
            logger.info(f"pgRouting version: {versions[1]}")
        except Exception as e:
            logger.error(f"Error checking extensions: {e}")
            logger.warning("pgRouting extension may not be properly installed")
        
        # Check for NULL geometries before creating topology
        cur.execute("SELECT COUNT(*) FROM edges WHERE the_geom IS NULL;")
        null_geoms = cur.fetchone()[0]
        if null_geoms > 0:
            logger.warning(f"Found {null_geoms} edges with NULL geometries - these will cause problems")
            cur.execute("DELETE FROM edges WHERE the_geom IS NULL;")
            conn.commit()
            logger.info(f"Deleted {null_geoms} edges with NULL geometries")
        
        # Get the SRID first - we'll need this throughout
        cur.execute("SELECT ST_SRID(the_geom) FROM edges WHERE the_geom IS NOT NULL LIMIT 1;")
        srid_result = cur.fetchone()
        if srid_result and srid_result[0]:
            srid = srid_result[0]
            logger.info(f"Edge geometries are using SRID {srid}")
        else:
            logger.error("Could not determine SRID from edges table")
            # Default to NYC state plane
            srid = 2263
            logger.info(f"Using default SRID {srid}")
        
        # Check geometry types - we'll work with them as-is
        cur.execute("""
            SELECT ST_GeometryType(the_geom), COUNT(*)
            FROM edges
            GROUP BY ST_GeometryType(the_geom);
        """)
        geom_types = cur.fetchall()
        for geom_type, count in geom_types:
            logger.info(f"Found {count} edges with geometry type {geom_type}")
        
        # Check for invalid geometries
        cur.execute("SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(the_geom);")
        invalid_count = cur.fetchone()[0]
        if invalid_count > 0:
            logger.warning(f"Found {invalid_count} invalid geometries, attempting to fix...")
            cur.execute("UPDATE edges SET the_geom = ST_MakeValid(the_geom) WHERE NOT ST_IsValid(the_geom);")
            conn.commit()
            logger.info(f"Fixed invalid geometries")
        
        # Check for invalid start/end points
        logger.info("Checking for edges without valid start/end points...")
        cur.execute("""
            SELECT COUNT(*) FROM edges 
            WHERE ST_IsEmpty(ST_StartPoint(the_geom)) OR ST_IsEmpty(ST_EndPoint(the_geom));
        """)
        invalid_endpoints = cur.fetchone()[0]
        if invalid_endpoints > 0:
            logger.warning(f"Found {invalid_endpoints} edges with invalid start/end points")
            cur.execute("""
                DELETE FROM edges 
                WHERE ST_IsEmpty(ST_StartPoint(the_geom)) OR ST_IsEmpty(ST_EndPoint(the_geom));
            """)
            conn.commit()
            logger.info(f"Deleted {invalid_endpoints} edges with invalid endpoints")

        # Ensure source and target columns exist with correct data type
        logger.info("Ensuring source and target columns exist with correct type...")
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM information_schema.columns 
                              WHERE table_name = 'edges' AND column_name = 'source') THEN
                    ALTER TABLE edges ADD COLUMN source INTEGER;
                ELSE
                    ALTER TABLE edges ALTER COLUMN source TYPE INTEGER;
                END IF;
                
                IF NOT EXISTS (SELECT FROM information_schema.columns 
                              WHERE table_name = 'edges' AND column_name = 'target') THEN
                    ALTER TABLE edges ADD COLUMN target INTEGER;
                ELSE
                    ALTER TABLE edges ALTER COLUMN target TYPE INTEGER;
                END IF;
            END $$;
        """)
        conn.commit()
        
        # Calculate appropriate tolerance based on SRID
        if srid == 2263:  # NY State Plane (feet)
            tolerance = 0.5  # 0.5 feet is reasonable for snapping
        else:
            tolerance = 0.00001  # Small value for lat/long
            
        logger.info(f"Using tolerance of {tolerance} for SRID {srid}")
        
        # Check if we have any edges left
        cur.execute("SELECT COUNT(*) FROM edges;")
        edge_count = cur.fetchone()[0]
        if edge_count == 0:
            logger.error("No edges remain in the table after processing!")
            return
            
        # Create the vertices table first
        logger.info("Creating vertices table for topology...")
        cur.execute(f"""
            DROP TABLE IF EXISTS edges_vertices_pgr;
            CREATE TABLE edges_vertices_pgr (
                id SERIAL PRIMARY KEY,
                the_geom GEOMETRY(POINT, {srid})
            );
            
            -- Create spatial index right away
            CREATE INDEX edges_vertices_pgr_idx ON edges_vertices_pgr USING GIST (the_geom);
        """)
        conn.commit()
        
        # Get min/max ID for batch processing
        cur.execute("SELECT MIN(id), MAX(id) FROM edges;")
        min_id, max_id = cur.fetchone()
        
        # Start with smaller batches that will grow if performance is good
        batch_size = 500
        batches = []
        
        # Create batches with progressive size increase if performance is good
        current_id = min_id
        while current_id <= max_id:
            end_id = min(current_id + batch_size - 1, max_id)
            batches.append((current_id, end_id))
            current_id = end_id + 1
        
        total_batches = len(batches)
        
        # Determine initial number of workers based on CPU count (start conservatively)
        import multiprocessing
        max_workers = max(1, int(multiprocessing.cpu_count() * 0.5))
        logger.info(f"Starting topology creation with {max_workers} workers for {total_batches} batches")
        
        # Get database connection parameters for worker processes
        db_params = {
            'user': os.getenv('POSTGRES_USER'),
            'host': os.getenv('POSTGRES_HOST'),
            'dbname': os.getenv('POSTGRES_DB'),
            'password': os.getenv('POSTGRES_PASSWORD'),
            'port': os.getenv('POSTGRES_PORT', '5432')
        }
        
        # Prepare batch parameters for workers
        batch_params = []
        for start_id, end_id in batches:
            batch_params.append((start_id, end_id, tolerance, db_params))
        
        # Track total processed edges
        processed_edges = 0
        successful_batches = 0
        
        # Track performance metrics
        execution_times = []
        maintenance_counter = 0
        maintenance_interval = 10  # Perform maintenance every 10 batches by default
        last_worker_count = max_workers
        
        # Process batches in parallel with progress bar
        with tqdm(total=total_batches, desc="Creating topology") as pbar:
            # Process in smaller chunks to allow for maintenance and worker adjustments
            for chunk_start in range(0, len(batch_params), maintenance_interval):
                chunk_end = min(chunk_start + maintenance_interval, len(batch_params))
                current_chunk = batch_params[chunk_start:chunk_end]
                
                # Adjust workers based on performance trend - minimal logging
                if len(execution_times) >= 5:
                    # If performance is degrading, reduce workers
                    if execution_times[-1] > execution_times[-5] * 1.5:
                        max_workers = max(1, max_workers - 1)
                        # Only log if worker count actually changed
                        if max_workers != last_worker_count:
                            pbar.set_postfix_str(f"Reducing to {max_workers} workers due to performance")
                            last_worker_count = max_workers
                    # If performance is stable or improving, consider adding workers
                    elif execution_times[-1] <= execution_times[-5] * 1.1:
                        max_workers = min(multiprocessing.cpu_count(), max_workers + 1)
                        # Only log if worker count actually changed
                        if max_workers != last_worker_count:
                            pbar.set_postfix_str(f"Increasing to {max_workers} workers")
                            last_worker_count = max_workers
                
                # Use ProcessPoolExecutor for parallel processing
                with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as executor:
                    # Submit current chunk of batches to the executor
                    future_to_batch = {executor.submit(process_topology_batch, params): i for i, params in enumerate(current_chunk, start=chunk_start)}
                    
                    # Process results as they complete
                    for future in concurrent.futures.as_completed(future_to_batch):
                        batch_idx = future_to_batch[future]
                        try:
                            # Get the result from this batch
                            start_id, success, batch_success_count, batch_total, exec_time = future.result()
                            
                            # Track execution time
                            execution_times.append(exec_time)
                            avg_time = sum(execution_times[-5:]) / min(len(execution_times), 5)
                            
                            # Update progress information
                            if success:
                                # Calculate success rate for this batch
                                success_rate = batch_success_count / batch_total * 100 if batch_total > 0 else 0
                                pbar.set_postfix(
                                    success=f"{success_rate:.1f}%", 
                                    edges=f"{processed_edges + batch_success_count}/{edge_count}",
                                    time=f"{avg_time:.1f}s",
                                    workers=max_workers
                                )
                                
                                processed_edges += batch_success_count
                                successful_batches += 1
                            else:
                                pbar.set_postfix(
                                    status="failed", 
                                    edges=f"{processed_edges}/{edge_count}",
                                    time=f"{avg_time:.1f}s"
                                )
                            
                            # Update progress bar
                            pbar.update(1)
                            
                        except Exception as e:
                            # Handle any errors in the future processing
                            pbar.set_postfix_str(f"Error: {str(e)[:20]}...")
                            pbar.update(1)
                
                # Perform maintenance operations between chunks to maintain performance - minimal logging
                maintenance_counter += 1
                if maintenance_counter >= 1:  # Do maintenance after each chunk
                    # Update progress bar instead of logging
                    previous_postfix = pbar.postfix
                    pbar.set_postfix_str("Maintaining indexes...")
                    perform_maintenance(cur, conn)
                    maintenance_counter = 0
                    # Restore previous postfix
                    pbar.set_postfix_str(previous_postfix.decode() if isinstance(previous_postfix, bytes) else previous_postfix)
        
        # Final status after all batches
        if successful_batches > 0:
            success_rate = successful_batches / total_batches * 100
            logger.info(f"Completed {successful_batches}/{total_batches} batches ({success_rate:.1f}%)")
        
        # Check final topology status
        cur.execute("SELECT COUNT(*) FROM edges_vertices_pgr;")
        vertex_count = cur.fetchone()[0]
        logger.info(f"Created {vertex_count} vertices in topology")
        
        cur.execute("SELECT COUNT(*) FROM edges WHERE source IS NULL OR target IS NULL;")
        null_nodes = cur.fetchone()[0]
        success_percent = (edge_count - null_nodes) / edge_count * 100 if edge_count > 0 else 0
        logger.info(f"Topology created with {edge_count - null_nodes} valid edges ({success_percent:.2f}%)")
        
    except Exception as e:
        logger.error(f"Error creating topology: {e}")
        conn.rollback()


def error_check(cur, conn, tolerance):
    try:
        # First check if topology exists at all
        try:
            cur.execute("SELECT COUNT(*) FROM edges_vertices_pgr;")
            vertex_count = cur.fetchone()[0]
            logger.info(f"Found {vertex_count} vertices in topology")
        except Exception as e:
            logger.error(f"edges_vertices_pgr table does not exist: {e}")
            logger.error("Topology creation failed completely")
            return
            
        logger.info('Analyzing Graph...')
        query = "SELECT pgr_analyzeGraph('edges', %s, 'the_geom');"
        cur.execute(query, (tolerance,))
        result = cur.fetchone()[0]
        logger.info(result)
        
        # If analysis fails, try to get more diagnostics
        if result == 'FAIL':
            logger.warning("Graph analysis failed - checking for issues...")
            cur.execute("""
                SELECT count(*) FROM edges WHERE source IS NULL OR target IS NULL;
            """)
            null_nodes = cur.fetchone()[0]
            logger.warning(f"Found {null_nodes} edges with NULL source or target nodes")
            
            if null_nodes > 0:
                # Try to fix some null nodes if there aren't too many
                if null_nodes < 1000:
                    logger.info("Attempting to repair some edges with NULL nodes...")
                    cur.execute("""
                        DELETE FROM edges WHERE source IS NULL OR target IS NULL;
                    """)
                    conn.commit()
                    logger.info(f"Deleted {null_nodes} edges with NULL nodes")
                    
                    # Try analysis again
                    try:
                        cur.execute(query, (tolerance,))
                        result = cur.fetchone()[0]
                        logger.info(f"After repair, graph analysis: {result}")
                    except Exception as e:
                        logger.error(f"Error in second graph analysis: {e}")
                        conn.rollback()

        logger.info('Analyzing One Way...')
        one_way_query = (
            "SELECT pgr_analyzeOneway('edges', ARRAY['', 'B', 'W'], ARRAY['', 'B', 'A'], "
            "ARRAY['', 'B', 'W'], ARRAY['', 'B', 'A'], oneway := 'trafdir');"
        )
        cur.execute(one_way_query)
        result_one_way = cur.fetchone()[0]
        logger.info(result_one_way)
    except Exception as e:
        logger.error(f"Error in error_check: {e}")
        conn.rollback()
        # Don't re-raise, allow the process to continue


def find_turn_restrictions(cur, conn, dir_path):
    """
    Creates turn restrictions for grade-separated intersections.
    """
    logger.info('Finding Grade Separation Turn Restrictions...')
    try:
        # First check if topology exists at all
        try:
            cur.execute("SELECT 1 FROM edges_vertices_pgr LIMIT 1;")
        except Exception as e:
            logger.error(f"edges_vertices_pgr table does not exist: {e}")
            logger.error("Skipping turn restrictions due to missing topology")
            return
            
        # First, check if level_from and level_to columns exist
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'edges' AND column_name = 'level_from'
            );
        """)
        level_from_exists = cur.fetchone()[0]
        
        if not level_from_exists:
            logger.warning("level_from column does not exist, skipping turn restrictions")
            return
            
        # Check if we have any grade separation data first - if not, skip this step
        cur.execute("SELECT COUNT(*) FROM edges WHERE nodelevelf IS NOT NULL OR nodelevelt IS NOT NULL;")
        count_with_levels = cur.fetchone()[0]
        if count_with_levels == 0:
            logger.info("No grade separations found - skipping turn restrictions")
            return
        
        # Create restrictions table
        execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', 'restrictions.sql'))
            
        # Create indexes on level fields
        logger.info("Creating indexes on level fields...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS edges_nodelevelf_idx ON edges(nodelevelf);
            CREATE INDEX IF NOT EXISTS edges_nodelevelt_idx ON edges(nodelevelt);
            CREATE INDEX IF NOT EXISTS edges_level_from_idx ON edges(level_from);
            CREATE INDEX IF NOT EXISTS edges_level_to_idx ON edges(level_to);
        """)
        conn.commit()
            
        # Update node levels using parameterized queries
        for c in string.ascii_uppercase:
            idx = 1 + string.ascii_uppercase.index(c)
            cur.execute(
                "UPDATE public.edges SET level_from = %s WHERE nodelevelf = %s;", (idx, c)
            )
            cur.execute(
                "UPDATE public.edges SET level_to = %s WHERE nodelevelt = %s;", (idx, c)
            )
        conn.commit()

        # Process in larger batches for better performance
        cur.execute(
            "SELECT COUNT(*) FROM edges WHERE source IS NOT NULL AND target IS NOT NULL;"
        )
        total_edges = cur.fetchone()[0]
        logger.info(f"Processing turn restrictions for {total_edges} edges")
        
        # Process in chunks of 50,000 edges for better performance
        batch_size = 50000
        offset = 0
        
        # Count total batches for the single progress bar
        total_batches = (total_edges + batch_size - 1) // batch_size
        restrictions_to_insert = []
        restriction_count = 0
        
        # Single progress bar for entire process
        with tqdm(total=total_edges, desc="Processing turn restrictions") as pbar:
            while offset < total_edges:
                cur.execute(
                    """
                    SELECT id, source, target, nodelevelf, nodelevelt, trafdir 
                    FROM edges 
                    WHERE source IS NOT NULL AND target IS NOT NULL
                    ORDER BY id
                    LIMIT %s OFFSET %s
                    """, 
                    (batch_size, offset)
                )
                
                batch_rows = cur.fetchall()
                if not batch_rows:
                    break
                    
                batch_size_actual = len(batch_rows)
                batch_num = offset // batch_size + 1
                
                # Update progress bar description
                pbar.set_postfix_str(f"Batch {batch_num}/{total_batches}, Found {restriction_count} restrictions")
                
                # Process in this batch
                batch_restrictions = []
                
                # Process batch without nested progress bar
                for row in batch_rows:
                    edge_id = row[0]
                    target_node_id = row[2]
                    nodelevelt = row[4]
                    if isinstance(nodelevelt, str) and nodelevelt.isalpha():
                        try:
                            seg_level_to_idx = string.ascii_uppercase.index(nodelevelt)
                        except ValueError:
                            # Handle case where character is not in ascii_uppercase
                            seg_level_to_idx = 50
                    else:
                        seg_level_to_idx = 50

                    cur.execute("SELECT id, nodelevelf, nodelevelt FROM edges WHERE source = %s;", (target_node_id,))
                    row_result = cur.fetchall()

                    for r in row_result:
                        nodelevelf2 = r[1]
                        if isinstance(nodelevelf2, str) and nodelevelf2.isalpha():
                            try:
                                seg2_level_from_idx = string.ascii_uppercase.index(nodelevelf2)
                            except ValueError:
                                # Handle case where character is not in ascii_uppercase
                                seg2_level_from_idx = 50
                        else:
                            seg2_level_from_idx = 50

                        if seg2_level_from_idx != seg_level_to_idx:
                            if seg2_level_from_idx + 1 != seg_level_to_idx and seg2_level_from_idx - 1 != seg_level_to_idx:
                                # this is a grade separation turn restriction!
                                batch_restrictions.append((r[0], edge_id))
                
                # Insert restrictions for this batch
                if batch_restrictions:
                    try:
                        # Use executemany for better performance
                        cur.executemany(
                            "INSERT INTO restrictions (to_cost, to_edge, from_edge) VALUES (100, %s, %s);",
                            batch_restrictions
                        )
                        conn.commit()
                        num_inserted = len(batch_restrictions)
                        restriction_count += num_inserted
                        pbar.set_postfix_str(f"Batch {batch_num}/{total_batches}, Found {restriction_count} restrictions")
                    except Exception as e:
                        logger.error(f"Error inserting restrictions batch: {e}")
                        conn.rollback()
                
                # Update progress
                pbar.update(batch_size_actual)
                offset += batch_size_actual
        
        # Create indexes on the restrictions table
        try:
            logger.info("Creating indexes on restrictions table...")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_restrictions_from_edge ON restrictions(from_edge);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_restrictions_to_edge ON restrictions(to_edge);")
            conn.commit()
            logger.info(f"Created {restriction_count} turn restrictions in total")
        except Exception as e:
            logger.error(f"Error creating restriction indexes: {e}")
            conn.rollback()
            
    except Exception as e:
        logger.error(f"Error in find_turn_restrictions: {e}")
        conn.rollback()


def create_functions(cur, conn, dir_path):
    """
    Creates routing functions that include connectivity fixes for disconnected components.
    """
    logger.info("Creating routing functions...")
    try:
        # Check if connectivity_fixes table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'connectivity_fixes'
            );
        """)
        has_fixes = cur.fetchone()[0]
        
        # Choose appropriate SQL file based on whether we have connectivity fixes
        if has_fixes:
            file_path = os.path.join(dir_path, 'sql', 'functions.sql')
            
            # Read the original functions file
            with open(file_path, 'r') as f:
                sql = f.read()
            
            # Modify the functions to include connectivity fixes for driving
            driving_function = sql.replace(
                "'SELECT id, source, target, cost_drive AS cost, rcost_drive as reverse_cost FROM edges where driveable=TRUE'",
                """'SELECT id, source, target, cost_drive AS cost, rcost_drive as reverse_cost FROM edges where driveable=TRUE
                   UNION ALL
                   SELECT id, source, target, cost, rcost FROM connectivity_fixes'"""
            )
            
            # Modify the functions to include connectivity fixes for biking
            biking_function = driving_function.replace(
                "'SELECT id, source, target, cost_bike AS cost, rcost_bike as reverse_cost FROM edges where bikeable=TRUE'",
                """'SELECT id, source, target, cost_bike AS cost, rcost_bike as reverse_cost FROM edges where bikeable=TRUE
                   UNION ALL
                   SELECT id, source, target, cost, rcost FROM connectivity_fixes'"""
            )
            
            # Modify the functions to include connectivity fixes for walking
            walking_function = biking_function.replace(
                "'SELECT id, source, target, cost_walk AS cost FROM edges where walkable=TRUE'",
                """'SELECT id, source, target, cost_walk AS cost FROM edges where walkable=TRUE
                   UNION ALL
                   SELECT id, source, target, cost FROM connectivity_fixes'"""
            )
            
            # Execute the modified SQL
            cur.execute(walking_function)
            logger.info("Created routing functions with connectivity fixes")
        else:
            # Use the original functions file
            file_path = os.path.join(dir_path, 'sql', 'functions.sql')
            with open(file_path, 'r') as f:
                sql = f.read()
            cur.execute(sql)
            logger.info("Created standard routing functions")
            
        conn.commit()
    except Exception as e:
        logger.error(f"Error creating functions: {e}")
        conn.rollback()


def validate_connectivity(cur, conn):
    """
    Validates network connectivity to ensure there are no disconnected components.
    """
    logger.info("Validating network connectivity...")
    try:
        # Check if vertices table exists
        try:
            cur.execute("SELECT 1 FROM edges_vertices_pgr LIMIT 1;")
        except Exception as e:
            logger.error(f"Cannot validate connectivity: {e}")
            logger.error("Topology creation likely failed")
            return
            
        # First fix any NULL values in source/target
        cur.execute("SELECT COUNT(*) FROM edges WHERE source IS NULL OR target IS NULL;")
        null_count = cur.fetchone()[0]
        
        if null_count > 0:
            logger.warning(f"Found {null_count} edges with NULL source or target - these will be excluded from connectivity checks")
        
        # Check for basic connectivity first (avoid expensive pgr_connectedComponents if possible)
        try:
            cur.execute("""
                SELECT count(distinct source) + count(distinct target) AS node_count,
                       count(*) AS edge_count
                FROM edges 
                WHERE source IS NOT NULL AND target IS NOT NULL;
            """)
            result = cur.fetchone()
            node_count, edge_count = result
            
            logger.info(f"Network has {node_count} nodes and {edge_count} edges")
            
            if edge_count == 0:
                logger.error("Network has no valid edges!")
                return
                
            # Create a temporary table for valid edges
            cur.execute("""
                DROP TABLE IF EXISTS temp_valid_edges;
                CREATE TEMP TABLE temp_valid_edges AS
                SELECT id, source, target
                FROM edges 
                WHERE source IS NOT NULL AND target IS NOT NULL
                LIMIT 1000;
            """)
            conn.commit()
            
            # Now use the temp table for connected components check
            try:
                cur.execute("""
                    SELECT count(*) FROM pgr_connectedComponents(
                        'SELECT id, source, target, 1 as cost FROM temp_valid_edges'
                    );
                """)
                component_count = cur.fetchone()[0]
                logger.info(f"Sample connectivity check found {component_count} connected components in first 1000 edges")
            except Exception as e:
                logger.error(f"Error in connected components check: {e}")
                # Try a simpler connectivity check
                logger.info("Trying a simpler connectivity check...")
                cur.execute("""
                    SELECT COUNT(DISTINCT source) AS source_count,
                           COUNT(DISTINCT target) AS target_count
                    FROM temp_valid_edges;
                """)
                source_count, target_count = cur.fetchone()
                logger.info(f"Network has {source_count} distinct source nodes and {target_count} distinct target nodes")
            
            # Clean up
            cur.execute("DROP TABLE IF EXISTS temp_valid_edges;")
            conn.commit()
            
        except Exception as e:
            logger.error(f"Error during basic connectivity check: {e}")
            logger.info("Skipping full connectivity validation due to previous error")
            conn.rollback()
            return
            
        # Additional validation - check for orphaned nodes
        cur.execute("""
            SELECT count(*) FROM edges_vertices_pgr v 
            LEFT JOIN edges e ON v.id = e.source OR v.id = e.target
            WHERE e.id IS NULL;
        """)
        
        orphaned_nodes = cur.fetchone()[0]
        if orphaned_nodes > 0:
            logger.warning(f"Network has {orphaned_nodes} orphaned nodes!")
        
        conn.commit()
    except Exception as e:
        logger.error(f"Error validating connectivity: {e}")
        conn.rollback()


def cleanup_temporary_data(cur, conn):
    """
    Cleans up temporary tables and data after processing
    """
    logger.info("Cleaning up temporary data...")
    try:
        # First check if the connection is still active and not in a failed transaction state
        try:
            cur.execute("SELECT 1")
            conn.commit()
        except Exception:
            # If we can't execute a simple query, the connection might be in a bad state
            logger.warning("Connection appears to be in failed transaction state, attempting to recover")
            conn.rollback()
            
        # Check each table before analyzing
        tables_to_check = ['edges', 'edges_vertices_pgr', 'restrictions']
        for table in tables_to_check:
            try:
                cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}');")
                if cur.fetchone()[0]:
                    cur.execute(f"ANALYZE {table};")
                    logger.info(f"Analyzed table: {table}")
            except Exception as e:
                logger.error(f"Error analyzing {table}: {e}")
                continue
                
        conn.commit()
        logger.info("Cleanup completed successfully")
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        conn.rollback()


def parallel_process(func, items, max_workers=4):
    """
    Execute a function across multiple items in parallel
    """
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(func, items))
    return results


def import_traffic_volumes(cur, conn, csv_file_path):
    """
    Import traffic volume data from a CSV file into the database.
    The CSV should have the NYC DOT Automated Traffic Volume Counts format.
    """
    logger.info(f"Importing traffic volume data from {csv_file_path}...")
    
    try:
        # Create the traffic_volumes table if it doesn't exist
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
        conn.commit()
        
        # Read CSV file
        processed_rows = 0
        batch_size = 5000
        batch_data = []
        
        with open(csv_file_path, 'r') as file:
            reader = csv.DictReader(file)
            
            for row in tqdm(reader, desc="Processing traffic volume data"):
                try:
                    # Parse the CSV data
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
                    
                    # Create date and time objects
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
                        _insert_traffic_batch(cur, conn, batch_data)
                        processed_rows += len(batch_data)
                        batch_data = []
                        
                except Exception as e:
                    logger.error(f"Error processing row: {row}")
                    logger.error(f"Error details: {e}")
                    continue
        
        # Insert any remaining data
        if batch_data:
            _insert_traffic_batch(cur, conn, batch_data)
            processed_rows += len(batch_data)
        
        # Create indexes
        logger.info("Creating indexes on traffic volume data...")
        cur.execute("""
            CREATE INDEX traffic_volumes_segment_idx ON traffic_volumes(segment_id);
            CREATE INDEX traffic_volumes_time_idx ON traffic_volumes(hour_of_day, day_of_week);
            CREATE INDEX traffic_volumes_date_idx ON traffic_volumes(count_date);
        """)
        conn.commit()
        
        logger.info(f"Successfully imported {processed_rows} traffic volume records")
        return True
    except Exception as e:
        logger.error(f"Error importing traffic volume data: {e}")
        conn.rollback()
        return False

def _insert_traffic_batch(cur, conn, batch_data):
    """Helper function to insert a batch of traffic volume data"""
    try:
        # Prepare the SQL query
        query = """
            INSERT INTO traffic_volumes 
            (request_id, borough, count_date, count_time, volume, segment_id, 
             location, street, from_street, to_street, direction, hour_of_day, day_of_week)
            VALUES (%s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 2263), %s, %s, %s, %s, %s, %s)
        """
        
        # Prepare the data
        values = []
        for item in batch_data:
            values.append((
                item['request_id'],
                item['borough'],
                item['count_date'],
                item['count_time'],
                item['volume'],
                item['segment_id'],
                item['wkt_geom'],
                item['street'],
                item['from_street'],
                item['to_street'],
                item['direction'],
                item['hour_of_day'],
                item['day_of_week']
            ))
        
        # Execute the batch insert
        cur.executemany(query, values)
        conn.commit()
    except Exception as e:
        logger.error(f"Error inserting traffic batch: {e}")
        conn.rollback()
        # Don't re-raise, as we want to continue with the next batch

def process_traffic_data(cur, conn):
    """
    Process traffic volume data to create traffic factors and time-based costs.
    This creates aggregated statistics and updates edge costs.
    """
    logger.info("Processing traffic volume data...")
    
    try:
        # Check if traffic_volumes table exists and has data
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'traffic_volumes');")
        has_traffic_data = cur.fetchone()[0]
        
        if not has_traffic_data:
            logger.warning("Traffic volumes table does not exist. Skipping traffic data processing.")
            return False
        
        cur.execute("SELECT COUNT(*) FROM traffic_volumes;")
        traffic_count = cur.fetchone()[0]
        
        if traffic_count == 0:
            logger.warning("Traffic volumes table is empty. Skipping traffic data processing.")
            return False
            
        logger.info(f"Found {traffic_count} traffic volume records to process")
        
        # Create aggregated traffic table by segment, hour, and day of week
        logger.info("Creating aggregated traffic statistics...")
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
        conn.commit()
        
        # Add traffic factor column to edges table
        logger.info("Adding traffic factors to edges table...")
        cur.execute("""
            ALTER TABLE edges ADD COLUMN IF NOT EXISTS traffic_factor FLOAT DEFAULT 1.0;
            ALTER TABLE edges ADD COLUMN IF NOT EXISTS segmentid BIGINT;
            
            -- Extract segmentid from join_id if it's in the format expected
            UPDATE edges 
            SET segmentid = NULLIF(REGEXP_REPLACE(join_id, '^.*?([0-9]+).*$', '\\1'), '')::BIGINT
            WHERE join_id ~ '.*[0-9]+.*';
            
            -- Create an index on segmentid
            CREATE INDEX IF NOT EXISTS edges_segmentid_idx ON edges(segmentid);
        """)
        conn.commit()
        
        # Join traffic data to edges using segmentid
        logger.info("Calculating traffic factors for edges...")
        cur.execute("""
            -- Create a temp table mapping each segment to its avg traffic
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
                
            -- Calculate the maximum volume across all segments
            WITH max_stats AS (
                SELECT MAX(max_volume) AS global_max_volume FROM segment_traffic
            )
            -- Update traffic factors based on normalized volumes
            UPDATE edges e
            SET traffic_factor = CASE 
                WHEN s.avg_volume = 0 THEN 1.0  -- No data
                WHEN s.avg_volume > (SELECT global_max_volume * 0.75 FROM max_stats) THEN 3.0  -- Very heavy traffic (>75% of max)
                WHEN s.avg_volume > (SELECT global_max_volume * 0.5 FROM max_stats) THEN 2.0   -- Heavy traffic (>50% of max)
                WHEN s.avg_volume > (SELECT global_max_volume * 0.25 FROM max_stats) THEN 1.5  -- Medium traffic (>25% of max)
                WHEN s.avg_volume > 0 THEN 1.2  -- Light traffic
                ELSE 1.0  -- No data or zero traffic
            END
            FROM segment_traffic s
            WHERE e.id = s.edge_id;
        """)
        conn.commit()
        
        # Get statistics on traffic factors
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
        logger.info(f"Traffic factor range: {stats[0]} to {stats[1]} (avg: {stats[2]:.2f})")
        
        return True
    except Exception as e:
        logger.error(f"Error processing traffic data: {e}")
        conn.rollback()
        return False

def create_traffic_routing_functions(cur, conn):
    """
    Create additional routing functions that incorporate traffic data for time-based routing.
    """
    logger.info("Creating traffic-based routing functions...")
    
    try:
        # Check if traffic data was processed
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'traffic_factor');")
        has_traffic_factor = cur.fetchone()[0]
        
        if not has_traffic_factor:
            logger.warning("Traffic factor column does not exist in edges table. Skipping traffic routing functions.")
            return False
            
        # Ensure segmentid is BIGINT if it exists and needs changing
        cur.execute("""
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'edges' AND column_name = 'segmentid';
        """)
        segment_type = cur.fetchone()
        
        if segment_type and segment_type[0] != 'bigint':
            logger.info("Converting segmentid column to BIGINT...")
            cur.execute("ALTER TABLE edges ALTER COLUMN segmentid TYPE BIGINT;")
            conn.commit()
            
        # Also check avg_traffic_by_segment table if it exists
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'avg_traffic_by_segment');")
        if cur.fetchone()[0]:
            cur.execute("""
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_name = 'avg_traffic_by_segment' AND column_name = 'segment_id';
            """)
            avg_segment_type = cur.fetchone()
            
            if avg_segment_type and avg_segment_type[0] != 'bigint':
                logger.info("Converting segment_id column in avg_traffic_by_segment to BIGINT...")
                cur.execute("ALTER TABLE avg_traffic_by_segment ALTER COLUMN segment_id TYPE BIGINT;")
                conn.commit()
            
        # Time-based driving function
        logger.info("Creating time-based driving routing function...")
        cur.execute("""
            DROP FUNCTION IF EXISTS getdrivingroute_with_traffic(double precision, double precision, double precision, double precision, integer, integer);
            
            CREATE FUNCTION getdrivingroute_with_traffic(
                _start_lat FLOAT, _start_lon FLOAT, 
                _end_lat FLOAT, _end_lon FLOAT,
                _hour INTEGER, _day_of_week INTEGER)
            RETURNS TABLE(
                seq INT,
                id VARCHAR,
                street VARCHAR,
                travel_time FLOAT,
                distance FLOAT,
                geom GEOMETRY
            ) AS
            $func$
            BEGIN
                RETURN QUERY
                WITH time_specific_costs AS (
                    SELECT
                        e.id,
                        e.source,
                        e.target,
                        -- Apply traffic factor based on time, or use base cost if no specific data
                        CASE 
                            WHEN tf.traffic_factor IS NOT NULL THEN 
                                e.cost_drive * tf.traffic_factor
                            ELSE 
                                e.cost_drive * e.traffic_factor
                        END AS cost,
                        CASE 
                            WHEN tf.traffic_factor IS NOT NULL THEN 
                                e.rcost_drive * tf.traffic_factor
                            ELSE 
                                e.rcost_drive * e.traffic_factor
                        END AS reverse_cost
                    FROM 
                        edges e
                    LEFT JOIN 
                        avg_traffic_by_segment tf 
                        ON e.segmentid = tf.segment_id 
                        AND tf.hour_of_day = _hour 
                        AND tf.day_of_week = _day_of_week
                    WHERE 
                        e.driveable = TRUE
                ),
                routing_result AS (
                    SELECT * FROM pgr_dijkstra(
                        'SELECT id, source, target, cost, reverse_cost FROM time_specific_costs',
                        getnearestnode(_start_lat, _start_lon),
                        getnearestnode(_end_lat, _end_lon),
                        directed := TRUE
                    )
                )
                SELECT
                    min(r.seq) AS seq,
                    e.join_id AS id,
                    e.street,
                    sum(
                        CASE 
                            WHEN tf.traffic_factor IS NOT NULL THEN 
                                e.time_drive * tf.traffic_factor
                            ELSE 
                                e.time_drive * e.traffic_factor
                        END
                    ) AS travel_time,
                    sum(e.length_feet) AS distance,
                    ST_Collect(e.the_geom) AS geom
                FROM 
                    routing_result r
                JOIN 
                    edges e ON r.edge = e.id
                LEFT JOIN 
                    avg_traffic_by_segment tf 
                    ON e.segmentid = tf.segment_id 
                    AND tf.hour_of_day = _hour 
                    AND tf.day_of_week = _day_of_week
                GROUP BY
                    e.join_id,
                    e.street
                ORDER BY 
                    seq;
            END
            $func$ LANGUAGE plpgsql;
        """)
        conn.commit()
        
        # Create a function to get current hour's traffic routing
        logger.info("Creating current traffic routing function...")
        cur.execute("""
            DROP FUNCTION IF EXISTS getdrivingroute_current_traffic(double precision, double precision, double precision, double precision);
            
            CREATE FUNCTION getdrivingroute_current_traffic(
                _start_lat FLOAT, _start_lon FLOAT, 
                _end_lat FLOAT, _end_lon FLOAT)
            RETURNS TABLE(
                seq INT,
                id VARCHAR,
                street VARCHAR,
                travel_time FLOAT,
                distance FLOAT,
                geom GEOMETRY
            ) AS
            $func$
            DECLARE
                current_hour INTEGER;
                current_day INTEGER;
            BEGIN
                -- Get current hour and day of week
                SELECT 
                    EXTRACT(HOUR FROM NOW()) INTO current_hour;
                
                SELECT 
                    EXTRACT(DOW FROM NOW()) + 1 INTO current_day;  -- 1=Monday, 7=Sunday
                
                -- Call the time-specific function with current time
                RETURN QUERY
                SELECT * FROM getdrivingroute_with_traffic(
                    _start_lat, _start_lon, _end_lat, _end_lon,
                    current_hour, current_day
                );
            END
            $func$ LANGUAGE plpgsql;
        """)
        conn.commit()
        
        logger.info("Successfully created traffic-based routing functions")
        return True
    except Exception as e:
        logger.error(f"Error creating traffic routing functions: {e}")
        conn.rollback()
        return False

def main():
    start_time = datetime.now()
    dir_path = os.path.dirname(os.path.realpath(__file__))
    user = os.getenv('POSTGRES_USER')
    password = os.getenv('POSTGRES_PASSWORD')
    database = os.getenv('POSTGRES_DB')
    host = os.getenv('POSTGRES_HOST')
    port = os.getenv('POSTGRES_PORT', '5432')
    traffic_data = os.getenv('TRAFFIC_DATA_FILE')  # Path to traffic data CSV file
    
    logger.info(f"Starting network creation process at {start_time}")

    try:
        # Using a context manager to ensure the connection is closed properly.
        connect_params = {
            'user': user,
            'host': host,
            'dbname': database,
            'password': password,
            'port': port
        }
        
        # Try to set a longer timeout for long-running queries
        connect_params['connect_timeout'] = 60  # 60 seconds timeout
        
        with psycopg.connect(**connect_params) as conn:
            with conn.cursor() as cur:
                # Always verify that PostGIS and pgRouting are installed
                try:
                    cur.execute("SELECT postgis_full_version();")
                    postgis_version = cur.fetchone()[0]
                    logger.info(f"PostGIS: {postgis_version}")
                    
                    cur.execute("SELECT pgr_version();")
                    pgr_version = cur.fetchone()[0]
                    logger.info(f"pgRouting: {pgr_version}")
                except Exception as e:
                    logger.error(f"Error verifying extensions: {e}")
                    logger.error("Make sure PostGIS and pgRouting extensions are properly installed")
                    return
                
                create_edges(cur, conn, dir_path)
                calculate_travel_times(cur, conn, dir_path, CONFIG['speeds'])
                calculate_segment_costs(cur, conn, dir_path)
                create_topology(cur, conn, dir_path, CONFIG['topology_batch_size'])
                error_check(cur, conn, CONFIG['tolerance'])
                
                # Each function now handles its own transactions and errors
                find_turn_restrictions(cur, conn, dir_path)
                create_functions(cur, conn, dir_path)
                validate_connectivity(cur, conn)
                
                # Process traffic data if available
                if traffic_data:
                    logger.info(f"Traffic data file specified: {traffic_data}")
                    if os.path.exists(traffic_data):
                        import_traffic_volumes(cur, conn, traffic_data)
                        process_traffic_data(cur, conn)
                        create_traffic_routing_functions(cur, conn)
                    else:
                        logger.warning(f"Traffic data file not found: {traffic_data}")
                
                cleanup_temporary_data(cur, conn)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")

    delta = datetime.now() - start_time
    logger.info(f"Finished in {delta}")


if __name__ == '__main__':
    main()

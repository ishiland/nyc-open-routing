import os
import logging
from datetime import datetime
import psycopg
import concurrent.futures
from tqdm import tqdm 
import csv
from traffic_volumes import import_traffic_volumes, process_traffic_data, create_traffic_routing_functions
from utils import TqdmLoggingHandler, logger

# Configuration parameters
CONFIG = {
    'tolerance': 0.0003,
    'topology_batch_size': 500,  # Smaller batch size for better stability
    'speeds': {
        'walk_mph': 3,  # Average walking speed in mph
        'bike_mph': 12,  # Average biking speed in mph
        'ferry_mph': 25  # Average ferry speed in mph
    }
}

def setup_notice_handler(conn):
    """Setup psycopg3 notice handler for server messages"""
    def notice_handler(diag):
        """Handle PostgreSQL notices, warnings, and info messages"""
        severity = diag.severity
        message = diag.message_primary

        if severity in ('NOTICE', 'INFO'):
            logger.info(f"  {severity}: {message}")
        elif severity == 'WARNING':
            logger.warning(f"  {severity}: {message}")

    conn.add_notice_handler(notice_handler)

def execute_sql_file(cur, conn, file_path, params=None):
    """Execute SQL from files with enhanced error reporting and RAISE handling"""
    import re
    from psycopg import errors

    file_name = os.path.basename(file_path)

    try:
        with open(file_path, 'r') as file:
            sql = file.read()

        # Track execution progress for long-running files
        logger.info(f"Executing {file_name}...")

        # For files with dollar-quoted strings (function definitions), execute whole file
        if "$func$" in sql or "$$" in sql:
            try:
                cur.execute(sql)
                conn.commit()
                logger.info(f"✓ {file_name} completed successfully")
                return True
            except errors.RaiseException as e:
                # Handle intentional RAISE statements (NOTICE, WARNING, INFO)
                error_msg = str(e)

                # Check if it's an informational message or actual error
                if any(keyword in error_msg.upper() for keyword in ['NOTICE', 'INFO']):
                    logger.info(f"  {error_msg}")
                    conn.commit()
                    return True
                elif 'WARNING' in error_msg.upper():
                    logger.warning(f"  {error_msg}")
                    conn.commit()
                    return True
                else:
                    # Actual EXCEPTION - this is a real error
                    logger.error(f"✗ {file_name} failed: {error_msg}")
                    conn.rollback()
                    raise
            except Exception as e:
                logger.error(f"✗ {file_name} failed: {e}")
                conn.rollback()
                raise

        # For regular SQL files, split by semicolon but respect DO blocks
        else:
            # Enhanced statement splitting that handles DO blocks properly
            # Match DO $$ ... END $$; blocks as single units
            do_block_pattern = r'DO\s+\$\$.*?END\s+\$\$\s*;'
            do_blocks = re.findall(do_block_pattern, sql, re.DOTALL | re.IGNORECASE)

            # Replace DO blocks with placeholders
            sql_with_placeholders = sql
            for i, block in enumerate(do_blocks):
                sql_with_placeholders = sql_with_placeholders.replace(block, f'__DO_BLOCK_{i}__', 1)

            # Split by semicolon
            statements = sql_with_placeholders.split(';')

            # Restore DO blocks
            restored_statements = []
            for stmt in statements:
                restored_stmt = stmt
                for i, block in enumerate(do_blocks):
                    if f'__DO_BLOCK_{i}__' in restored_stmt:
                        # Remove semicolon from block since it's already included
                        restored_stmt = restored_stmt.replace(f'__DO_BLOCK_{i}__', block.rstrip(';'))
                if restored_stmt.strip():
                    restored_statements.append(restored_stmt)

            # Execute statements
            total_statements = len(restored_statements)
            for idx, statement in enumerate(restored_statements, 1):
                statement = statement.strip()
                if not statement:
                    continue

                try:
                    if params:
                        cur.execute(statement, params)
                    else:
                        cur.execute(statement)

                except errors.RaiseException as e:
                    error_msg = str(e)

                    # Handle intentional RAISE statements
                    if any(keyword in error_msg.upper() for keyword in ['NOTICE', 'INFO']):
                        logger.info(f"  {error_msg}")
                        continue
                    elif 'WARNING' in error_msg.upper():
                        logger.warning(f"  {error_msg}")
                        continue
                    else:
                        # Actual EXCEPTION - this is a real error
                        logger.error(f"✗ {file_name} failed at statement {idx}/{total_statements}")
                        logger.error(f"  Error: {error_msg}")
                        logger.error(f"  Statement preview: {statement[:200]}...")
                        conn.rollback()
                        raise

                except Exception as e:
                    logger.error(f"✗ {file_name} failed at statement {idx}/{total_statements}")
                    logger.error(f"  Error: {e}")
                    logger.error(f"  Statement preview: {statement[:200]}...")
                    conn.rollback()
                    raise

            conn.commit()
            logger.info(f"✓ {file_name} completed successfully ({total_statements} statements)")
            return True

    except FileNotFoundError as e:
        logger.error(f"✗ SQL file not found: {file_path}")
        raise
    except Exception as e:
        logger.error(f"✗ Error executing SQL file {file_name}: {e}")
        conn.rollback()
        raise

def create_edges_table(cur, conn, dir_path):
    """Create and prepare edges table"""
    logger.info('Creating edges table...')
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', '01_edges.sql'))
    
    # Check and fix invalid geometries
    cur.execute("SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(the_geom);")
    invalid_count = cur.fetchone()[0]
    if invalid_count > 0:
        logger.warning(f"Found {invalid_count} invalid geometries, fixing...")
        cur.execute("UPDATE edges SET the_geom = ST_MakeValid(the_geom) WHERE NOT ST_IsValid(the_geom);")
        conn.commit()

def create_topology(cur, conn, dir_path):
    """Create topology using pgr_createTopology on entire edges table"""
    logger.info("Creating topology...")

    try:
        # Check PostGIS and pgRouting versions
        cur.execute("SELECT postgis_full_version(), pgr_version();")
        versions = cur.fetchone()
        logger.info(f"PostGIS: {versions[0][:50]}...")
        logger.info(f"pgRouting: {versions[1]}")

        # Get SRID
        cur.execute("SELECT ST_SRID(the_geom) FROM edges WHERE the_geom IS NOT NULL LIMIT 1;")
        srid = cur.fetchone()[0] or 2263
        logger.info(f"Geometry SRID: {srid}")

        # Log geometry types
        cur.execute("SELECT ST_GeometryType(the_geom), COUNT(*) FROM edges GROUP BY ST_GeometryType(the_geom);")
        for geom_type, count in cur.fetchall():
            logger.info(f"Found {count} edges with {geom_type}")

        # Remove problematic geometries
        cur.execute("DELETE FROM edges WHERE the_geom IS NULL;")
        deleted_null = cur.rowcount
        cur.execute("DELETE FROM edges WHERE ST_IsEmpty(ST_StartPoint(the_geom)) OR ST_IsEmpty(ST_EndPoint(the_geom));")
        deleted_empty = cur.rowcount
        if deleted_null > 0 or deleted_empty > 0:
            logger.warning(f"Removed {deleted_null} NULL and {deleted_empty} empty geometries")
        conn.commit()

        # Check edge count
        cur.execute("SELECT COUNT(*) FROM edges;")
        edge_count = cur.fetchone()[0]
        if edge_count == 0:
            raise Exception("No edges to process after cleaning")

        logger.info(f"Processing {edge_count} edges for topology creation")

        # Create topology using official pgRouting 3.8+ approach
        logger.info("Creating topology with pgr_extractVertices (official method)...")
        start_time = datetime.now()

        # Optimize session parameters for bulk operations
        logger.info("Setting session parameters for bulk operations...")
        cur.execute("""
            SET work_mem = '256MB';
            SET temp_buffers = '500MB';
            SET maintenance_work_mem = '512MB';
        """)
        conn.commit()

        # Pre-flight validation: Check geometry types
        logger.info("Validating edge geometries...")
        cur.execute("""
            SELECT
                ST_GeometryType(the_geom) as geom_type,
                COUNT(*) as count
            FROM edges
            GROUP BY ST_GeometryType(the_geom);
        """)
        geom_types = cur.fetchall()

        for geom_type, count in geom_types:
            logger.info(f"  - {count:,} edges with type {geom_type}")
            if geom_type not in ('ST_LineString', 'ST_MultiLineString'):
                logger.error(f"ERROR: Unexpected geometry type: {geom_type}")
                raise ValueError(f"Edges must be LineString or MultiLineString, found {geom_type}")

        # Check for NULL or invalid geometries
        cur.execute("""
            SELECT COUNT(*)
            FROM edges
            WHERE the_geom IS NULL
               OR ST_IsEmpty(the_geom)
               OR NOT ST_IsValid(the_geom);
        """)
        invalid_count = cur.fetchone()[0]

        if invalid_count > 0:
            logger.warning(f"  - {invalid_count} edges have NULL or invalid geometries (will be excluded from routing)")

        # Step 1: Extract vertices with edge relationships
        logger.info("Step 1/5: Extracting vertices from edges...")
        step_start = datetime.now()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS edges_vertices_pgr AS
            SELECT *
            FROM pgr_extractVertices('SELECT id, the_geom AS geom FROM edges');
        """)
        conn.commit()
        step_time = (datetime.now() - step_start).total_seconds()
        logger.info(f"  Completed in {step_time:.1f} seconds")

        # Step 2: Create spatial index on vertices (improves future queries)
        logger.info("Step 2/5: Creating spatial index on vertices...")
        step_start = datetime.now()
        cur.execute("""
            CREATE INDEX IF NOT EXISTS edges_vertices_pgr_geom_idx
            ON edges_vertices_pgr USING GIST (geom);
            ANALYZE edges_vertices_pgr;
        """)
        conn.commit()
        step_time = (datetime.now() - step_start).total_seconds()
        logger.info(f"  Completed in {step_time:.1f} seconds")

        # Step 3: Check if we have x1, y1, x2, y2 columns in edges table
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'edges'
            AND column_name IN ('x1', 'y1', 'x2', 'y2');
        """)
        coord_columns = [row[0] for row in cur.fetchall()]
        has_coord_columns = len(coord_columns) == 4

        # Step 4: Update source using out_edges array (official pgRouting method)
        logger.info("Step 4/5: Populating source nodes using edge arrays...")
        step_start = datetime.now()
        if has_coord_columns:
            cur.execute("""
                WITH out_going AS (
                    SELECT
                        id AS vid,
                        unnest(out_edges) AS eid,
                        x,
                        y
                    FROM edges_vertices_pgr
                )
                UPDATE edges
                SET source = vid, x1 = x, y1 = y
                FROM out_going
                WHERE edges.id = eid;
            """)
        else:
            cur.execute("""
                WITH out_going AS (
                    SELECT
                        id AS vid,
                        unnest(out_edges) AS eid
                    FROM edges_vertices_pgr
                )
                UPDATE edges
                SET source = vid
                FROM out_going
                WHERE edges.id = eid;
            """)
        conn.commit()
        step_time = (datetime.now() - step_start).total_seconds()
        logger.info(f"  Completed in {step_time:.1f} seconds")

        # Step 5: Update target using in_edges array (official pgRouting method)
        logger.info("Step 5/5: Populating target nodes using edge arrays...")
        step_start = datetime.now()
        if has_coord_columns:
            cur.execute("""
                WITH in_coming AS (
                    SELECT
                        id AS vid,
                        unnest(in_edges) AS eid,
                        x,
                        y
                    FROM edges_vertices_pgr
                )
                UPDATE edges
                SET target = vid, x2 = x, y2 = y
                FROM in_coming
                WHERE edges.id = eid;
            """)
        else:
            cur.execute("""
                WITH in_coming AS (
                    SELECT
                        id AS vid,
                        unnest(in_edges) AS eid
                    FROM edges_vertices_pgr
                )
                UPDATE edges
                SET target = vid
                FROM in_coming
                WHERE edges.id = eid;
            """)
        conn.commit()
        step_time = (datetime.now() - step_start).total_seconds()
        logger.info(f"  Completed in {step_time:.1f} seconds")

        execution_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Topology creation completed in {execution_time:.1f} seconds")
        conn.commit()

        # Verify results with comprehensive validation
        logger.info("Validating topology...")

        # Check 1: Vertices with NULL coordinates (indicates phantom vertices)
        cur.execute("""
            SELECT COUNT(*)
            FROM edges_vertices_pgr
            WHERE x IS NULL OR y IS NULL OR geom IS NULL;
        """)
        null_vertex_count = cur.fetchone()[0]

        if null_vertex_count > 0:
            logger.error(f"CRITICAL: {null_vertex_count} vertices have NULL coordinates!")
            logger.error("This indicates pgr_extractVertices received invalid geometry types.")
            raise ValueError(f"Topology validation failed: {null_vertex_count} vertices with NULL coordinates")

        # Check 2: Detect phantom vertices (abnormally high degree)
        cur.execute("""
            SELECT id,
                   array_length(in_edges, 1) as in_degree,
                   array_length(out_edges, 1) as out_degree
            FROM edges_vertices_pgr
            WHERE array_length(in_edges, 1) > 1000
               OR array_length(out_edges, 1) > 1000
            ORDER BY GREATEST(
                COALESCE(array_length(in_edges, 1), 0),
                COALESCE(array_length(out_edges, 1), 0)
            ) DESC
            LIMIT 5;
        """)
        high_degree_vertices = cur.fetchall()

        if high_degree_vertices:
            logger.error("CRITICAL: Found vertices with abnormally high degree (likely phantom vertices):")
            for vid, in_deg, out_deg in high_degree_vertices:
                logger.error(f"  - Vertex {vid}: {in_deg or 0} in-edges, {out_deg or 0} out-edges")
            raise ValueError("Topology validation failed: phantom vertices detected")

        # Check 3: Edge node assignments and distributions
        cur.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(DISTINCT source) as unique_sources,
                COUNT(DISTINCT target) as unique_targets,
                COUNT(*) FILTER (WHERE source IS NOT NULL AND target IS NOT NULL) as valid_edges,
                COUNT(*) FILTER (WHERE source IS NULL OR target IS NULL) as null_nodes
            FROM edges;
        """)
        edge_stats = cur.fetchone()
        total, unique_sources, unique_targets, valid_edges, null_nodes = edge_stats

        success_percent = (valid_edges / total * 100) if total > 0 else 0

        # Check 4: Vertex count
        cur.execute("SELECT COUNT(*) FROM edges_vertices_pgr;")
        vertex_count = cur.fetchone()[0]

        logger.info(f"✓ Topology validated successfully:")
        logger.info(f"  - {vertex_count:,} vertices (all with valid coordinates)")
        logger.info(f"  - {valid_edges:,} edges with source/target ({success_percent:.2f}%)")
        logger.info(f"  - {unique_sources:,} unique source nodes")
        logger.info(f"  - {unique_targets:,} unique target nodes")

        # Check 5: Verify source/target distribution is reasonable
        if unique_targets < vertex_count * 0.3:
            logger.error(f"CRITICAL: Only {unique_targets} unique targets vs {vertex_count} vertices")
            logger.error("This indicates edges may be pointing to phantom vertices.")
            raise ValueError("Topology validation failed: abnormal target distribution")

        if null_nodes > 0:
            logger.warning(f"  - {null_nodes} edges missing source/target nodes")
            if null_nodes > total * 0.01:  # More than 1% missing
                raise ValueError(f"Too many edges missing nodes: {null_nodes}/{total}")

        # Create indexes
        logger.info("Creating topology indexes...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS edges_source_idx ON edges(source);
            CREATE INDEX IF NOT EXISTS edges_target_idx ON edges(target);
        """)
        conn.commit()

        # Analyze tables for query planner
        logger.info("Analyzing tables...")
        cur.execute("ANALYZE edges;")
        cur.execute("ANALYZE edges_vertices_pgr;")
        conn.commit()

    except Exception as e:
        logger.error(f"Error creating topology: {e}")
        conn.rollback()
        raise

def calculate_travel_times(cur, conn, dir_path, speeds):
    """Calculate travel times for different modes"""
    logger.info('Calculating travel times...')
    # Simply execute the SQL file using the robust execute_sql_file function
    # The SQL file has hardcoded speeds that match our CONFIG defaults
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', '02_travel_time.sql'))

def calculate_costs(cur, conn, dir_path):
    """Calculate costs for edges"""
    logger.info('Calculating costs...')
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', '03_cost.sql'))

        
def find_turn_restrictions(cur, conn, dir_path):
    """Create turn restrictions for grade-separated intersections"""
    logger.info('Finding turn restrictions...')
    try:
        # Check prerequisites
        cur.execute("SELECT EXISTS (SELECT 1 FROM edges_vertices_pgr LIMIT 1);")
        if not cur.fetchone()[0]:
            logger.warning("Skipping turn restrictions - missing topology")
            return
        
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'level_from');")
        if not cur.fetchone()[0]:
            logger.warning("Skipping turn restrictions - missing level_from column")
            return
        
        # Check for grade separations
        cur.execute("SELECT COUNT(*) FROM edges WHERE nodelevelf IS NOT NULL OR nodelevelt IS NOT NULL;")
        if cur.fetchone()[0] == 0:
            logger.info("No grade separations found - skipping turn restrictions")
            return
        
        # Create restrictions table and populate from SQL file
        # The SQL file handles all restriction logic based on level_from/level_to
        execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', '04_restrictions.sql'))

        # Query actual restriction count from database
        cur.execute("SELECT COUNT(*) FROM restrictions;")
        restriction_count = cur.fetchone()[0]
        logger.info(f"Created {restriction_count} turn restrictions")
            
    except Exception as e:
        logger.error(f"Error in find_turn_restrictions: {e}")
        conn.rollback()

def create_functions(cur, conn, dir_path):
    """Create routing functions"""
    logger.info("Creating routing functions...")
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', '05_functions.sql'))


def create_performance_indexes(cur, conn, dir_path):
    """Create performance optimization indexes"""
    logger.info("Creating performance indexes...")
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', '06_performance_indexes.sql'))


def main():
    start_time = datetime.now()
    dir_path = os.path.dirname(os.path.realpath(__file__))
    
    # Get environment variables
    user = os.getenv('POSTGRES_USER')
    password = os.getenv('POSTGRES_PASSWORD')
    database = os.getenv('POSTGRES_DB')
    host = os.getenv('POSTGRES_HOST')
    port = os.getenv('POSTGRES_PORT', '5432')
    traffic_data = os.getenv('TRAFFIC_DATA_FILE')  # Path to traffic data CSV
    
    logger.info(f"Starting network creation process")

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
            # Setup notice handler for PostgreSQL messages
            setup_notice_handler(conn)

            with conn.cursor() as cur:

                # Create network step by step with error context
                try:
                    create_edges_table(cur, conn, dir_path)
                except Exception as e:
                    logger.error(f"Failed at step: create_edges_table")
                    raise

                try:
                    calculate_travel_times(cur, conn, dir_path, CONFIG['speeds'])
                except Exception as e:
                    logger.error(f"Failed at step: calculate_travel_times")
                    raise

                try:
                    calculate_costs(cur, conn, dir_path)
                except Exception as e:
                    logger.error(f"Failed at step: calculate_costs")
                    raise

                try:
                    create_topology(cur, conn, dir_path)
                except Exception as e:
                    logger.error(f"Failed at step: create_topology")
                    raise

                try:
                    find_turn_restrictions(cur, conn, dir_path)
                except Exception as e:
                    logger.error(f"Failed at step: find_turn_restrictions")
                    raise

                try:
                    create_functions(cur, conn, dir_path)
                except Exception as e:
                    logger.error(f"Failed at step: create_functions")
                    raise

                try:
                    create_performance_indexes(cur, conn, dir_path)
                except Exception as e:
                    logger.error(f"Failed at step: create_performance_indexes")
                    raise

                # Process traffic data if available
                if traffic_data:
                    try:
                        import_traffic_volumes(cur, conn, traffic_data)
                        process_traffic_data(cur, conn)
                        create_traffic_routing_functions(cur, conn)
                    except Exception as e:
                        logger.error(f"Failed at step: traffic data processing")
                        raise

                conn.commit()
                # if cur.execute("SELECT to_regclass('restrictions');"):
                #     if cur.fetchone()[0]:
                #         cur.execute("ANALYZE restrictions;")

    except Exception as e:
        logger.error(f"Network creation failed: {e}")
        import sys
        sys.exit(1)

    delta = datetime.now() - start_time
    logger.info(f"Finished in {delta}")


if __name__ == '__main__':
    main()

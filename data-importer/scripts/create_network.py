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
    'topology_batch_size': 500,  # Smaller batch size for better stability
    'speeds': {
        'walk_mph': 3,  # Average walking speed in mph
        'bike_mph': 12,  # Average biking speed in mph
        'ferry_mph': 25  # Average ferry speed in mph
    }
}

def execute_sql_file(cur, conn, file_path, params=None):
    """Execute SQL from files with better error reporting"""
    try:
        with open(file_path, 'r') as file:
            sql = file.read()
        
        # For files with dollar-quoted strings, execute the whole file at once
        if "$func$" in sql:
            cur.execute(sql)
            conn.commit()
            return True
            
        # For regular SQL files, split and execute statement by statement
        else:
            statements = sql.split(';')
            
            for statement in statements:
                if statement.strip():
                    try:
                        if params:
                            cur.execute(statement, params)
                        else:
                            cur.execute(statement)
                    except Exception as e:
                        logger.error(f"Error executing SQL: {e}")
                        conn.rollback()
                        raise
            
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error executing SQL file {file_path}: {e}")
        conn.rollback()
        return False

def process_topology_batch(batch_params):
    """Process a single topology batch in a separate process"""
    start_id, end_id, tolerance, db_params = batch_params
    
    try:
        start_time = datetime.now()
        
        with psycopg.connect(**db_params) as conn:
            with conn.cursor() as cur:
                batch_filter = f"id >= {start_id} AND id <= {end_id}"
                
                # Set statement timeout
                cur.execute("SET statement_timeout = 300000;")  # 5 minutes
                
                # Create topology for this batch
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
                
                # Check results
                cur.execute(f"SELECT COUNT(*) FROM edges WHERE {batch_filter} AND source IS NOT NULL AND target IS NOT NULL;")
                batch_success_count = cur.fetchone()[0]
                
                cur.execute(f"SELECT COUNT(*) FROM edges WHERE {batch_filter};")
                batch_total = cur.fetchone()[0]
                
                execution_time = (datetime.now() - start_time).total_seconds()
                return (start_id, True, batch_success_count, batch_total, execution_time)
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return (start_id, False, 0, 0, execution_time)

def perform_maintenance(cur, conn):
    """Maintain database performance"""
    try:
        cur.execute("REINDEX INDEX edges_vertices_pgr_idx;")
        cur.execute("ANALYZE edges_vertices_pgr;")
        cur.execute("ANALYZE edges;")
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Error during maintenance: {e}")
        conn.rollback()
        return False

def create_edges_table(cur, conn, dir_path):
    """Create and prepare edges table"""
    logger.info('Creating edges table...')
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', 'edges.sql'))
    
    # Check and fix invalid geometries
    cur.execute("SELECT COUNT(*) FROM edges WHERE NOT ST_IsValid(the_geom);")
    invalid_count = cur.fetchone()[0]
    if invalid_count > 0:
        logger.warning(f"Found {invalid_count} invalid geometries, fixing...")
        cur.execute("UPDATE edges SET the_geom = ST_MakeValid(the_geom) WHERE NOT ST_IsValid(the_geom);")
        conn.commit()

def create_topology(cur, conn, dir_path):
    """Create topology using parallel processing"""
    try:
        # Check PostGIS and pgRouting
        cur.execute("SELECT postgis_full_version(), pgr_version();")
        
        # Get SRID
        cur.execute("SELECT ST_SRID(the_geom) FROM edges WHERE the_geom IS NOT NULL LIMIT 1;")
        srid = cur.fetchone()[0] or 2263  # Default to NYC State Plane if not found
        
        # Log geometry types
        cur.execute("SELECT ST_GeometryType(the_geom), COUNT(*) FROM edges GROUP BY ST_GeometryType(the_geom);")
        for geom_type, count in cur.fetchall():
            logger.info(f"Found {count} edges with {geom_type}")
        
        # Remove problematic geometries
        cur.execute("DELETE FROM edges WHERE the_geom IS NULL;")
        cur.execute("DELETE FROM edges WHERE ST_IsEmpty(ST_StartPoint(the_geom)) OR ST_IsEmpty(ST_EndPoint(the_geom));")
        conn.commit()

        # Ensure source/target columns exist
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
        
        # Set tolerance based on SRID
        tolerance = 0.5 if srid == 2263 else 0.00001
        
        # Check edge count
        cur.execute("SELECT COUNT(*) FROM edges;")
        edge_count = cur.fetchone()[0]
        if edge_count == 0:
            logger.error("No edges to process")
            return
            
        # Create vertices table
        cur.execute(f"""
            DROP TABLE IF EXISTS edges_vertices_pgr;
            CREATE TABLE edges_vertices_pgr (
                id SERIAL PRIMARY KEY,
                the_geom GEOMETRY(POINT, {srid})
            );
            CREATE INDEX edges_vertices_pgr_idx ON edges_vertices_pgr USING GIST (the_geom);
        """)
        conn.commit()
        
        # Set up batches
        cur.execute("SELECT MIN(id), MAX(id) FROM edges;")
        min_id, max_id = cur.fetchone()
        batch_size = CONFIG['topology_batch_size']
        
        batches = []
        current_id = min_id
        while current_id <= max_id:
            end_id = min(current_id + batch_size - 1, max_id)
            batches.append((current_id, end_id))
            current_id = end_id + 1
        
        # Prepare for parallel processing
        import multiprocessing
        max_workers = max(1, int(multiprocessing.cpu_count() * 0.6))
        
        db_params = {
            'user': os.getenv('POSTGRES_USER'),
            'host': os.getenv('POSTGRES_HOST'),
            'dbname': os.getenv('POSTGRES_DB'),
            'password': os.getenv('POSTGRES_PASSWORD'),
            'port': os.getenv('POSTGRES_PORT', '5432')
        }
        
        batch_params = [(start_id, end_id, tolerance, db_params) for start_id, end_id in batches]
        processed_edges = 0
        
        # Process in chunks with maintenance between
        with tqdm(total=len(batches), desc="Creating topology") as pbar:
            for chunk_start in range(0, len(batch_params), 10):
                chunk_end = min(chunk_start + 10, len(batch_params))
                current_chunk = batch_params[chunk_start:chunk_end]
                
                with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as executor:
                    futures = {executor.submit(process_topology_batch, params): i 
                               for i, params in enumerate(current_chunk, start=chunk_start)}
                    
                    for future in concurrent.futures.as_completed(futures):
                        try:
                            start_id, success, batch_success_count, batch_total, exec_time = future.result()
                            
                            if success:
                                processed_edges += batch_success_count
                                pbar.set_postfix(
                                    edges=f"{processed_edges}/{edge_count}",
                                    time=f"{exec_time:.1f}s"
                                )
                            else:
                                pbar.set_postfix(status="failed")
                            
                            pbar.update(1)
                            
                        except Exception as e:
                            pbar.set_postfix_str(f"Error: {str(e)[:20]}...")
                            pbar.update(1)
                
                # Quick maintenance between chunks
                pbar.set_postfix_str("Maintaining indexes...")
                perform_maintenance(cur, conn)
        
        # Final status
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

def calculate_travel_times(cur, conn, dir_path, speeds):
    """Calculate travel times for different modes"""
    logger.info('Calculating travel times...')
    try:
        with open(os.path.join(dir_path, 'sql', 'travel_time.sql'), 'r') as file:
            query = file.read()
        
        # Set speeds
        walk_speed_hourly = speeds['walk_mph'] / 60
        bike_speed_hourly = speeds['bike_mph'] / 60
        ferry_speed_hourly = speeds['ferry_mph'] / 60
        
        # Replace values
        query = query.replace("/ .05", f"/ {walk_speed_hourly}")
        query = query.replace("/ .2", f"/ {bike_speed_hourly}")
        query = query.replace("/ .42", f"/ {ferry_speed_hourly}")
        
        # Execute 
        for stmt in query.split(';'):
            if stmt.strip():
                try:
                    cur.execute(stmt)
                    conn.commit()
                except Exception as e:
                    logger.error(f"Error in travel_time calculation: {e}")
                    conn.rollback()
    except Exception as e:
        logger.error(f"Error calculating travel times: {e}")
        conn.rollback()

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
        
        # Create restrictions table and indexes
        execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', 'restrictions.sql'))
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS edges_nodelevelf_idx ON edges(nodelevelf);
            CREATE INDEX IF NOT EXISTS edges_nodelevelt_idx ON edges(nodelevelt);
            CREATE INDEX IF NOT EXISTS edges_level_from_idx ON edges(level_from);
            CREATE INDEX IF NOT EXISTS edges_level_to_idx ON edges(level_to);
        """)
        conn.commit()
        
        # Update node levels
        for c in string.ascii_uppercase:
            idx = 1 + string.ascii_uppercase.index(c)
            cur.execute("UPDATE public.edges SET level_from = %s WHERE nodelevelf = %s;", (idx, c))
            cur.execute("UPDATE public.edges SET level_to = %s WHERE nodelevelt = %s;", (idx, c))
        conn.commit()
        
        # Process in batches
        cur.execute("SELECT COUNT(*) FROM edges WHERE source IS NOT NULL AND target IS NOT NULL;")
        total_edges = cur.fetchone()[0]
        
        batch_size = 50000
        offset = 0
        total_batches = (total_edges + batch_size - 1) // batch_size
        restriction_count = 0
        
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
                
                # Update progress bar
                pbar.set_postfix_str(f"Batch {batch_num}/{total_batches}, Found {restriction_count} restrictions")
                
                # Process batch
                batch_restrictions = []
                
                for row in batch_rows:
                    edge_id = row[0]
                    target_node_id = row[2]
                    nodelevelt = row[4]
                    
                    # Get level for current edge end
                    seg_level_to_idx = 50
                    if isinstance(nodelevelt, str) and nodelevelt.isalpha():
                        try:
                            seg_level_to_idx = string.ascii_uppercase.index(nodelevelt)
                        except ValueError:
                            pass
                    
                    # Find connected edges at target node
                    cur.execute("SELECT id, nodelevelf FROM edges WHERE source = %s;", (target_node_id,))
                    row_result = cur.fetchall()

                    for r in row_result:
                        nodelevelf2 = r[1]
                        
                        # Get level for connected edge start
                        seg2_level_from_idx = 50
                        if isinstance(nodelevelf2, str) and nodelevelf2.isalpha():
                            try:
                                seg2_level_from_idx = string.ascii_uppercase.index(nodelevelf2)
                            except ValueError:
                                pass
                        
                        # Add restriction if levels are non-adjacent
                        if seg2_level_from_idx != seg_level_to_idx:
                            if seg2_level_from_idx + 1 != seg_level_to_idx and seg2_level_from_idx - 1 != seg_level_to_idx:
                                batch_restrictions.append((r[0], edge_id))
                
                # Insert restrictions for this batch
                if batch_restrictions:
                    try:
                        cur.executemany(
                            "INSERT INTO restrictions (to_cost, to_edge, from_edge) VALUES (100, %s, %s);",
                            batch_restrictions
                        )
                        conn.commit()
                        restriction_count += len(batch_restrictions)
                        pbar.set_postfix_str(f"Batch {batch_num}/{total_batches}, Found {restriction_count} restrictions")
                    except Exception as e:
                        logger.error(f"Error inserting restrictions: {e}")
                        conn.rollback()
                
                # Update progress
                pbar.update(batch_size_actual)
                offset += batch_size_actual
        
        # Create indexes
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_restrictions_from_edge ON restrictions(from_edge);
            CREATE INDEX IF NOT EXISTS idx_restrictions_to_edge ON restrictions(to_edge);
        """)
        conn.commit()
        logger.info(f"Created {restriction_count} turn restrictions")
            
    except Exception as e:
        logger.error(f"Error in find_turn_restrictions: {e}")
        conn.rollback()

def create_functions(cur, conn, dir_path):
    """Create routing functions"""
    logger.info("Creating routing functions...")
    execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', 'functions.sql'))

def import_traffic_volumes(cur, conn, csv_file_path):
    """Import traffic volume data from CSV file"""
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
        conn.commit()
        
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
                        _insert_traffic_batch(cur, conn, batch_data)
                        processed_rows += len(batch_data)
                        batch_data = []
                        
                except Exception as e:
                    logger.error(f"Error processing traffic data row: {e}")
                    continue
        
        # Insert any remaining data
        if batch_data:
            _insert_traffic_batch(cur, conn, batch_data)
            processed_rows += len(batch_data)
        
        # Create indexes
        cur.execute("""
            CREATE INDEX traffic_volumes_segment_idx ON traffic_volumes(segment_id);
            CREATE INDEX traffic_volumes_time_idx ON traffic_volumes(hour_of_day, day_of_week);
            CREATE INDEX traffic_volumes_date_idx ON traffic_volumes(count_date);
        """)
        conn.commit()
        
        logger.info(f"Imported {processed_rows} traffic records")
        return True
    except Exception as e:
        logger.error(f"Error importing traffic data: {e}")
        conn.rollback()
        return False

def _insert_traffic_batch(cur, conn, batch_data):
    """Insert a batch of traffic volume data"""
    try:
        query = """
            INSERT INTO traffic_volumes 
            (request_id, borough, count_date, count_time, volume, segment_id, 
             location, street, from_street, to_street, direction, hour_of_day, day_of_week)
            VALUES (%s, %s, %s, %s, %s, %s, ST_GeomFromText(%s, 2263), %s, %s, %s, %s, %s, %s)
        """
        
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
        
        cur.executemany(query, values)
        conn.commit()
    except Exception as e:
        logger.error(f"Error inserting traffic batch: {e}")
        conn.rollback()

def process_traffic_data(cur, conn):
    """Process traffic data to create traffic factors"""
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
        conn.commit()
        
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
        conn.commit()
        
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
            conn.commit()
            
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
            conn.commit()
            
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
            conn.commit()
            
            # Create traffic factors from the spatially matched data
            cur.execute("""
                -- Get global maximum
                WITH max_stats AS (
                    SELECT MAX(max_volume) AS global_max_volume FROM edge_traffic_stats
                )
                -- Update traffic factors
                UPDATE edges e
                SET traffic_factor = CASE 
                    WHEN s.avg_volume IS NULL THEN 1.0  -- No data
                    WHEN s.avg_volume > (SELECT global_max_volume * 0.75 FROM max_stats) THEN 3.0  -- Very heavy
                    WHEN s.avg_volume > (SELECT global_max_volume * 0.5 FROM max_stats) THEN 2.0   -- Heavy
                    WHEN s.avg_volume > (SELECT global_max_volume * 0.25 FROM max_stats) THEN 1.5  -- Medium
                    WHEN s.avg_volume > 0 THEN 1.2  -- Light
                    ELSE 1.0  -- No data
                END
                FROM edge_traffic_stats s
                WHERE e.id = s.edge_id;
            """)
            conn.commit()
            
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
            conn.commit()
        
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
        conn.rollback()
        return False

def create_traffic_routing_functions(cur, conn):
    """Create traffic-aware routing functions"""
    logger.info("Creating traffic-based routing functions...")
    
    try:
        # Check if traffic data is available
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'edges' AND column_name = 'traffic_factor');")
        if not cur.fetchone()[0]:
            logger.warning("No traffic factor column found - skipping traffic routing functions")
            return False
        
        # Create current-time routing function that calls the existing function from functions.sql
        cur.execute("""
            DROP FUNCTION IF EXISTS getdrivingroute_current_traffic(double precision, double precision, double precision, double precision);
            
            CREATE FUNCTION getdrivingroute_current_traffic(
                _start_lon FLOAT, _start_lat FLOAT, 
                _end_lon FLOAT, _end_lat FLOAT)
            RETURNS TABLE(
                seq INT,
                id VARCHAR,
                street VARCHAR,
                travel_time FLOAT,
                distance FLOAT,
                traffic_factor FLOAT,
                geom GEOMETRY
            ) AS
            $func$
            DECLARE
                current_hour INTEGER;
                current_day INTEGER;
            BEGIN
                -- Get current hour and day of week
                SELECT EXTRACT(HOUR FROM NOW()) INTO current_hour;
                SELECT EXTRACT(DOW FROM NOW()) + 1 INTO current_day;  -- 1=Monday, 7=Sunday
                
                -- Call the time-specific function
                RETURN QUERY
                SELECT * FROM getdrivingroute_with_traffic(
                    _start_lon, _start_lat, _end_lon, _end_lat,
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
            with conn.cursor() as cur:
                # Verify extensions
                cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
                cur.execute("CREATE EXTENSION IF NOT EXISTS pgrouting;")
                conn.commit()
                
                # Create network step by step
                create_edges_table(cur, conn, dir_path)
                calculate_travel_times(cur, conn, dir_path, CONFIG['speeds'])
                execute_sql_file(cur, conn, os.path.join(dir_path, 'sql', 'cost.sql'))
                create_topology(cur, conn, dir_path)
                find_turn_restrictions(cur, conn, dir_path)
                create_functions(cur, conn, dir_path)
                
                # Process traffic data if available
                if traffic_data:
                    import_traffic_volumes(cur, conn, traffic_data)
                    process_traffic_data(cur, conn)
                    create_traffic_routing_functions(cur, conn)
                
                # Analyze tables for better performance
                cur.execute("ANALYZE edges; ANALYZE edges_vertices_pgr;")
                if cur.execute("SELECT to_regclass('restrictions');"):
                    if cur.fetchone()[0]:
                        cur.execute("ANALYZE restrictions;")
                conn.commit()
    except Exception as e:
        logger.error(f"Unexpected error: {e}")

    delta = datetime.now() - start_time
    logger.info(f"Finished in {delta}")


if __name__ == '__main__':
    main()

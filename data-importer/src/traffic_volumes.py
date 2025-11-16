import os
import csv
from datetime import datetime
from tqdm import tqdm
from psycopg import sql
from utils import TqdmLoggingHandler, logger


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

        # Validate that traffic_factor column exists (should be created by 01_edges.sql)
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'edges' AND column_name = 'traffic_factor';
        """)
        if not cur.fetchone():
            raise RuntimeError(
                "traffic_factor column not found in edges table. "
                "Please ensure the database was created with the latest schema (01_edges.sql)."
            )

        # Add segmentid column for traffic data matching
        cur.execute("""
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
                    SELECT MAX(avg_volume) AS global_max_volume FROM edge_traffic_stats
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
                    SELECT MAX(avg_volume) AS global_max_volume FROM segment_traffic
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
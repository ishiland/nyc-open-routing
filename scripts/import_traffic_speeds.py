#!/usr/bin/env python3
"""
Standalone script to import NYC DOT Traffic Speeds NBE data.

Fetches real-time speed observations from TRANSCOM sensors and converts them
into traffic_factor values on the edges table. Speed-based factors are more
direct than volume-based: factor = posted_speed / observed_speed.

Usage (inside the api container):
    python3 /scripts/import_traffic_speeds.py

Or from the host:
    docker compose exec api python3 /scripts/import_traffic_speeds.py
"""

import json
import os
import sys
import urllib.parse
import urllib.request

import psycopg

# Reuse the project logger
sys.path.insert(0, "/data-imports/src")
from utils import logger

SOCRATA_BASE = "https://data.cityofnewyork.us/resource/i4gi-tjb9.json"
FETCH_LIMIT = 5000
MATCH_BUFFER_METERS = 50
MIN_FACTOR = 1.0
MAX_FACTOR = 3.0
DEFAULT_POSTED_SPEED = 25  # NYC default speed limit


def get_connection_params():
    required = ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST"]
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        logger.error(f"Missing env vars: {', '.join(missing)}")
        sys.exit(1)

    return {
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "dbname": os.getenv("POSTGRES_DB"),
        "host": os.getenv("POSTGRES_HOST"),
        "port": os.getenv("POSTGRES_PORT", "5432"),
        "connect_timeout": 60,
    }


def fetch_latest_speeds():
    """Fetch the latest speed snapshot from the Socrata API."""
    query_params = urllib.parse.urlencode({
        "$select": "link_id,speed,travel_time,link_points,link_name,borough,data_as_of",
        "$where": "speed > '0'",
        "$order": "data_as_of DESC",
        "$limit": str(FETCH_LIMIT),
    })
    url = f"{SOCRATA_BASE}?{query_params}"

    logger.info("Fetching latest speed readings from NYC DOT Traffic Speeds NBE...")
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/json")

    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    logger.info(f"Received {len(data)} records from API")

    # Deduplicate by link_id — data is ordered by data_as_of DESC,
    # so first occurrence per link_id is the most recent reading
    seen = set()
    unique = []
    for row in data:
        lid = row.get("link_id")
        if lid and lid not in seen:
            seen.add(lid)
            unique.append(row)

    logger.info(f"Unique speed links after dedup: {len(unique)}")
    return unique


def parse_link_points(link_points_str):
    """Parse Socrata link_points string into WKT LINESTRING.

    Format: "lat1,lon1 lat2,lon2 ..." (space-separated lat,lon pairs)
    Returns WKT like "LINESTRING(lon1 lat1, lon2 lat2, ...)" or None.
    Validates coordinates fall within NYC bounding box.
    """
    if not link_points_str or not link_points_str.strip():
        return None

    pairs = link_points_str.strip().split(" ")
    coords = []
    for pair in pairs:
        parts = pair.split(",")
        if len(parts) != 2:
            continue
        try:
            lat, lon = float(parts[0]), float(parts[1])
            # Validate NYC bounding box — reject truncated/garbage coordinates
            if not (40.4 <= lat <= 41.0 and -74.3 <= lon <= -73.6):
                continue
            coords.append(f"{lon} {lat}")
        except ValueError:
            continue

    if len(coords) < 2:
        return None

    return f"LINESTRING({', '.join(coords)})"


def create_speed_table(cur, records):
    """Create the traffic_speeds staging table and insert records."""
    cur.execute("DROP TABLE IF EXISTS traffic_speeds CASCADE;")
    cur.execute("""
        CREATE TABLE traffic_speeds (
            id SERIAL PRIMARY KEY,
            link_id BIGINT,
            speed NUMERIC(8,2),
            travel_time INTEGER,
            link_name TEXT,
            borough TEXT,
            geom GEOMETRY(LINESTRING, 4326)
        );
    """)

    inserted = 0
    skipped = 0
    for rec in records:
        wkt = parse_link_points(rec.get("link_points", ""))
        if wkt is None:
            skipped += 1
            continue

        speed = float(rec.get("speed", 0))
        travel_time = int(float(rec.get("travel_time", 0)))

        cur.execute(
            """
            INSERT INTO traffic_speeds (link_id, speed, travel_time, link_name, borough, geom)
            VALUES (%s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326))
            """,
            (
                int(rec["link_id"]),
                speed,
                travel_time,
                rec.get("link_name", ""),
                rec.get("borough", ""),
                wkt,
            ),
        )
        inserted += 1

    logger.info(f"Staged {inserted} speed links ({skipped} skipped — no valid geometry)")
    return inserted


def match_speeds_to_edges(cur):
    """Spatially match speed links to LION edges within a buffer."""
    cur.execute("DROP TABLE IF EXISTS speed_edge_mapping CASCADE;")
    cur.execute(f"""
        CREATE TABLE speed_edge_mapping AS
        SELECT DISTINCT ON (ts.link_id, e.id)
            ts.link_id,
            e.id AS edge_id,
            ts.speed AS observed_speed,
            COALESCE(NULLIF(e.posted_speed, 0), {DEFAULT_POSTED_SPEED}) AS posted_speed,
            ST_Distance(e.geom_4326::geography, ts.geom::geography) AS distance
        FROM traffic_speeds ts
        JOIN edges e
            ON ST_DWithin(e.geom_4326::geography, ts.geom::geography, {MATCH_BUFFER_METERS})
            AND e.driveable = TRUE
            AND TRIM(e.rw_type) != '1'  -- exclude local streets; speed sensors are on highways/arterials
        ORDER BY ts.link_id, e.id, ST_Distance(e.geom_4326::geography, ts.geom::geography);
    """)

    cur.execute("SELECT COUNT(*), COUNT(DISTINCT edge_id), COUNT(DISTINCT link_id) "
                "FROM speed_edge_mapping;")
    total_pairs, unique_edges, matched_links = cur.fetchone()
    logger.info(
        f"Spatial matching: {matched_links} speed links matched to "
        f"{unique_edges} edges ({total_pairs} total pairs)"
    )
    return unique_edges


def update_traffic_factors(cur):
    """Compute traffic factors from speed data and update edges."""
    cur.execute(f"""
        UPDATE edges e
        SET traffic_factor = LEAST(GREATEST(
            sem.posted_speed / NULLIF(sem.observed_speed, 0),
            {MIN_FACTOR}), {MAX_FACTOR})
        FROM (
            SELECT edge_id,
                   AVG(observed_speed) AS observed_speed,
                   AVG(posted_speed) AS posted_speed
            FROM speed_edge_mapping
            GROUP BY edge_id
        ) sem
        WHERE e.id = sem.edge_id;
    """)

    updated = cur.rowcount
    logger.info(f"Updated traffic_factor on {updated} edges (direct match)")
    return updated


def propagate_traffic_factors(cur):
    """Propagate traffic factors to nearby unmatched edges on the same street.

    Speed link geometries are simplified (few points over miles of highway),
    so many LION edges along the corridor fall outside the match buffer.
    This fills gaps iteratively: each round spreads factors from edges that
    already have traffic data to nearby same-street edges within 200m.
    Multiple rounds let factors "walk" along corridors.
    """
    total_propagated = 0
    max_rounds = 5
    for round_num in range(1, max_rounds + 1):
        cur.execute("""
            UPDATE edges gap
            SET traffic_factor = neighbor.avg_factor
            FROM (
                SELECT gap_e.id,
                       AVG(matched_e.traffic_factor)::numeric(5,2) AS avg_factor
                FROM edges gap_e
                JOIN edges matched_e
                    ON matched_e.street = gap_e.street
                    AND matched_e.traffic_factor > 1.0
                    AND matched_e.driveable = TRUE
                    AND ST_DWithin(
                        matched_e.geom_4326::geography,
                        gap_e.geom_4326::geography,
                        200
                    )
                WHERE gap_e.traffic_factor = 1.0
                  AND gap_e.driveable = TRUE
                GROUP BY gap_e.id
            ) neighbor
            WHERE gap.id = neighbor.id;
        """)
        propagated = cur.rowcount
        total_propagated += propagated
        if propagated == 0:
            logger.info(f"Propagation converged after {round_num} rounds")
            break
        logger.info(f"  Round {round_num}: propagated to {propagated} edges")

    logger.info(f"Propagated traffic_factor to {total_propagated} total additional edges")
    return total_propagated


def print_summary(cur):
    """Print a summary of the traffic factor distribution."""
    cur.execute("""
        SELECT
            (SELECT COUNT(*) FROM edges) AS total_edges,
            COUNT(*) AS affected,
            AVG(traffic_factor) AS avg_factor,
            MIN(traffic_factor) AS min_factor,
            MAX(traffic_factor) AS max_factor,
            SUM(CASE WHEN traffic_factor >= 1.0 AND traffic_factor < 1.25 THEN 1 ELSE 0 END) AS free_flow,
            SUM(CASE WHEN traffic_factor >= 1.25 AND traffic_factor < 1.75 THEN 1 ELSE 0 END) AS light,
            SUM(CASE WHEN traffic_factor >= 1.75 AND traffic_factor < 2.25 THEN 1 ELSE 0 END) AS moderate,
            SUM(CASE WHEN traffic_factor >= 2.25 THEN 1 ELSE 0 END) AS heavy
        FROM edges
        WHERE traffic_factor > 1.0;
    """)
    row = cur.fetchone()
    (total_edges, affected, avg_factor, min_factor, max_factor,
     free_flow, light, moderate, heavy) = row

    logger.info("=" * 55)
    logger.info("Traffic Speeds Import Summary")
    logger.info("=" * 55)
    logger.info(f"Total edges:            {total_edges}")
    logger.info(f"Edges with traffic:     {affected} ({100 * affected / total_edges:.1f}%)")
    logger.info(f"Factor range:           {min_factor:.2f} - {max_factor:.2f}")
    logger.info(f"Average factor:         {avg_factor:.2f}")
    logger.info("-" * 55)
    logger.info(f"  Free flow  (1.0-1.25): {free_flow}")
    logger.info(f"  Light      (1.25-1.75): {light}")
    logger.info(f"  Moderate   (1.75-2.25): {moderate}")
    logger.info(f"  Heavy      (2.25-3.0):  {heavy}")
    logger.info("=" * 55)


def main():
    connect_params = get_connection_params()

    try:
        with psycopg.connect(**connect_params) as conn:
            with conn.cursor() as cur:
                # Verify edges table exists with required columns
                cur.execute(
                    "SELECT EXISTS (SELECT FROM information_schema.columns "
                    "WHERE table_name = 'edges' AND column_name = 'geom_4326');"
                )
                if not cur.fetchone()[0]:
                    logger.error(
                        "edges table or geom_4326 column not found. "
                        "Run the full import first: "
                        "docker compose exec api sh /data-imports/import-lion.sh 25a"
                    )
                    sys.exit(1)

                # Step 1: Fetch latest speed readings
                logger.info("Step 1/5: Fetching speed data...")
                records = fetch_latest_speeds()
                if not records:
                    logger.error("No speed records returned from API")
                    sys.exit(1)

                # Step 2: Create staging table
                logger.info("Step 2/5: Creating staging table...")
                staged = create_speed_table(cur, records)
                if staged == 0:
                    logger.error("No records staged — all had invalid geometry")
                    sys.exit(1)
                conn.commit()

                # Step 3: Spatial matching
                logger.info("Step 3/5: Matching speed links to edges...")
                matched = match_speeds_to_edges(cur)
                if matched == 0:
                    logger.warning(
                        "No edges matched. This could mean the network data "
                        "hasn't been imported or geom_4326 is not populated."
                    )
                    conn.commit()
                    return
                conn.commit()

                # Step 4: Reset and update traffic factors
                logger.info("Step 4/5: Updating traffic factors...")
                cur.execute("UPDATE edges SET traffic_factor = 1.0 WHERE traffic_factor != 1.0;")
                reset_count = cur.rowcount
                if reset_count:
                    logger.info(f"Reset traffic_factor on {reset_count} edges")
                update_traffic_factors(cur)
                conn.commit()

                # Step 5: Propagate factors to fill gaps
                logger.info("Step 5/5: Propagating factors to nearby edges...")
                propagate_traffic_factors(cur)
                conn.commit()

                # Summary
                print_summary(cur)

        logger.info(
            "Speed-based traffic import complete. "
            "The 'Use Traffic Data' toggle will now use speed-based factors."
        )
    except Exception:
        logger.exception("Traffic speeds import failed")
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Standalone traffic data import script.

Downloads NYC traffic volume data and imports it into the existing routing database,
enabling the "Use Traffic Data" toggle in the UI.

Usage (inside the api container):
    python3 /scripts/import_traffic.py

Or from the host:
    docker compose exec api python3 /scripts/import_traffic.py
"""

import os
import sys
import urllib.request
import tempfile

import psycopg

# Add data-importer source to path so we can import traffic_volumes module
sys.path.insert(0, "/data-imports/src")

from traffic_volumes import (
    import_traffic_volumes,
    process_traffic_data,
    create_traffic_routing_functions,
)
from utils import logger


TRAFFIC_CSV_URL = "https://data.cityofnewyork.us/api/views/7ym2-wayt/rows.csv"


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


def download_traffic_csv(dest_path):
    logger.info(f"Downloading traffic data from NYC Open Data...")
    logger.info(f"URL: {TRAFFIC_CSV_URL}")
    logger.info("This may take a few minutes (~100MB)...")

    urllib.request.urlretrieve(TRAFFIC_CSV_URL, dest_path)

    size_mb = os.path.getsize(dest_path) / (1024 * 1024)
    logger.info(f"Downloaded {size_mb:.1f} MB to {dest_path}")


def print_summary(cur):
    cur.execute("""
        SELECT
            COUNT(*) AS total_edges,
            SUM(CASE WHEN traffic_factor > 1.0 THEN 1 ELSE 0 END) AS affected,
            SUM(CASE WHEN traffic_factor = 1.2 THEN 1 ELSE 0 END) AS light,
            SUM(CASE WHEN traffic_factor = 1.5 THEN 1 ELSE 0 END) AS medium,
            SUM(CASE WHEN traffic_factor = 2.0 THEN 1 ELSE 0 END) AS heavy,
            SUM(CASE WHEN traffic_factor = 3.0 THEN 1 ELSE 0 END) AS very_heavy
        FROM edges
        WHERE traffic_factor IS NOT NULL;
    """)
    row = cur.fetchone()
    total, affected, light, medium, heavy, very_heavy = row

    logger.info("=" * 50)
    logger.info("Traffic Import Summary")
    logger.info("=" * 50)
    logger.info(f"Total edges:       {total}")
    logger.info(f"Edges with traffic: {affected} ({100 * affected / total:.1f}%)")
    logger.info(f"  Light (1.2x):    {light}")
    logger.info(f"  Medium (1.5x):   {medium}")
    logger.info(f"  Heavy (2.0x):    {heavy}")
    logger.info(f"  Very heavy (3.0x): {very_heavy}")
    logger.info("=" * 50)


def main():
    # Allow passing a local CSV path as argument to skip download
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
        if not os.path.exists(csv_path):
            logger.error(f"File not found: {csv_path}")
            sys.exit(1)
        logger.info(f"Using local CSV: {csv_path}")
        cleanup = False
    else:
        csv_path = os.path.join(tempfile.gettempdir(), "traffic_data.csv")
        download_traffic_csv(csv_path)
        cleanup = True

    connect_params = get_connection_params()

    try:
        with psycopg.connect(**connect_params) as conn:
            with conn.cursor() as cur:
                # Verify edges table exists
                cur.execute(
                    "SELECT EXISTS (SELECT FROM information_schema.tables "
                    "WHERE table_name = 'edges');"
                )
                if not cur.fetchone()[0]:
                    logger.error(
                        "edges table not found. Run the full import first: "
                        "docker compose exec api sh /data-imports/import-lion.sh 25a"
                    )
                    sys.exit(1)

                # Step 1: Import raw traffic CSV
                logger.info("Step 1/3: Importing traffic volumes...")
                ok = import_traffic_volumes(cur, conn, csv_path)
                if not ok:
                    logger.error("Failed to import traffic volumes")
                    sys.exit(1)

                # Step 2: Process traffic data into edge factors
                logger.info("Step 2/3: Processing traffic data...")
                ok = process_traffic_data(cur, conn)
                if not ok:
                    logger.error("Failed to process traffic data")
                    sys.exit(1)

                # Step 3: Create convenience routing functions
                logger.info("Step 3/3: Creating traffic routing functions...")
                create_traffic_routing_functions(cur, conn)

                # Summary
                print_summary(cur)

        logger.info("Traffic import complete. The 'Use Traffic Data' toggle is now functional.")
    finally:
        if cleanup and os.path.exists(csv_path):
            os.remove(csv_path)
            logger.info(f"Cleaned up {csv_path}")


if __name__ == "__main__":
    main()

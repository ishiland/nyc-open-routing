"""
TrafficRefreshService — manages background TRANSCOM speed data refresh cycle.

Fetches real-time speed observations from NYC DOT TRANSCOM sensors via the
Socrata API, spatially matches them to LION edges, and atomically updates
edges.traffic_factor. Uses a staging table pattern with IS DISTINCT FROM
filtering to avoid any inconsistency window during updates.
"""

import asyncio
import json
import logging
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import psycopg

logger = logging.getLogger(__name__)

SOCRATA_BASE = "https://data.cityofnewyork.us/resource/i4gi-tjb9.json"
FETCH_LIMIT = 5000
MATCH_BUFFER_METERS = 50
MIN_FACTOR = 1.0
MAX_FACTOR = 3.0
DEFAULT_POSTED_SPEED = 25


class TrafficRefreshService:
    """Manages background TRANSCOM speed data refresh cycle."""

    MAX_STARTUP_RETRIES = 3

    def __init__(self, db_params: dict, interval_seconds: int, route_cache):
        self._db_params = db_params
        self._interval_seconds = interval_seconds
        self._route_cache = route_cache
        self._data_loaded = False
        self._last_refresh_time = None
        self._last_success = None
        self._last_error = None
        self._edge_count = 0
        self._refresh_in_progress = False

    @property
    def status(self) -> dict:
        """Return current service status."""
        return {
            "enabled": True,
            "data_loaded": self._data_loaded,
            "last_refresh": (
                self._last_refresh_time.isoformat()
                if self._last_refresh_time
                else None
            ),
            "last_success": self._last_success,
            "last_error": self._last_error,
            "edge_count": self._edge_count,
            "refresh_interval_seconds": self._interval_seconds,
        }

    @property
    def data_loaded(self) -> bool:
        """Whether initial traffic data has been loaded."""
        return self._data_loaded

    async def run_refresh_loop(self):
        """Background loop: initial load then periodic refresh."""
        try:
            await self._initial_load()
            while True:
                await asyncio.sleep(self._interval_seconds)
                try:
                    await asyncio.to_thread(self._do_refresh_cycle)
                except Exception as e:
                    logger.error(f"Traffic refresh cycle failed: {e}")
                    self._last_error = str(e)
        except asyncio.CancelledError:
            logger.info("Traffic refresh loop cancelled")
            raise
        except Exception as e:
            logger.error(f"Traffic refresh loop unexpected error: {e}")
            self._last_error = str(e)

    async def _initial_load(self):
        """Startup load with retry logic (up to MAX_STARTUP_RETRIES)."""
        for attempt in range(1, self.MAX_STARTUP_RETRIES + 1):
            try:
                await asyncio.to_thread(
                    self._do_refresh_cycle, propagation_rounds=5
                )
                self._data_loaded = True
                logger.info("Initial traffic data loaded successfully")
                return
            except Exception as e:
                if attempt < self.MAX_STARTUP_RETRIES:
                    delay = 2 ** attempt
                    logger.warning(
                        f"Startup traffic load attempt {attempt} failed: "
                        f"{e}. Retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"All {self.MAX_STARTUP_RETRIES} startup attempts "
                        f"failed: {e}. Traffic data unavailable."
                    )

    async def trigger_refresh(self):
        """Manual refresh trigger. Returns (success, error_message)."""
        if self._refresh_in_progress:
            return (False, "Refresh already in progress")
        try:
            await asyncio.to_thread(self._do_refresh_cycle)
            return (True, None)
        except Exception as e:
            return (False, str(e))

    def _do_refresh_cycle(self, propagation_rounds=2):
        """Execute one complete refresh cycle (runs in thread via to_thread).

        Args:
            propagation_rounds: Number of spatial propagation rounds.
                Use 5 for initial load, 2 for recurring refresh.
        """
        self._refresh_in_progress = True
        conn = None
        try:
            cycle_start = time.monotonic()

            # Step 1: Fetch speed data from Socrata API
            t0 = time.monotonic()
            records = self._fetch_latest_speeds()
            logger.info(
                f"Fetched {len(records)} speed records in "
                f"{time.monotonic() - t0:.1f}s"
            )

            if not records:
                logger.warning(
                    "No speed records returned from API — skipping cycle"
                )
                return

            # Step 2: Open connection and run all DB work in one transaction
            conn = psycopg.connect(**self._db_params, autocommit=False)
            cur = conn.cursor()

            # Stage speed records
            t0 = time.monotonic()
            staged = self._create_speed_staging(cur, records)
            logger.info(
                f"Staged {staged} speed links in "
                f"{time.monotonic() - t0:.1f}s"
            )

            if staged == 0:
                logger.warning(
                    "No valid speed records after staging — skipping cycle"
                )
                conn.rollback()
                return

            # Spatial match to edges
            t0 = time.monotonic()
            matched = self._match_speeds_to_edges(cur)
            logger.info(
                f"Matched {matched} unique edges in "
                f"{time.monotonic() - t0:.1f}s"
            )

            if matched == 0:
                logger.warning(
                    "No edges matched — network data may not be imported"
                )
                conn.rollback()
                return

            # Compute and apply traffic factors atomically
            t0 = time.monotonic()
            updated = self._apply_traffic_factors_atomic(cur)
            logger.info(
                f"Updated {updated} edge traffic factors in "
                f"{time.monotonic() - t0:.1f}s"
            )

            # Propagate to nearby edges
            if propagation_rounds > 0:
                t0 = time.monotonic()
                propagated = self._propagate_traffic_factors(
                    cur, max_rounds=propagation_rounds
                )
                logger.info(
                    f"Propagated to {propagated} additional edges in "
                    f"{time.monotonic() - t0:.1f}s"
                )

            # Commit the entire transaction
            conn.commit()

            # Update state on success
            self._last_refresh_time = datetime.now(timezone.utc)
            self._last_success = True
            self._last_error = None

            # Clear route cache so new routes use updated factors
            if self._route_cache is not None:
                self._route_cache.clear()
                logger.info("Route cache cleared after traffic refresh")

            total_time = time.monotonic() - cycle_start
            logger.info(
                f"Traffic refresh cycle complete in {total_time:.1f}s "
                f"({self._edge_count} edges with traffic data)"
            )

        except Exception as e:
            if conn is not None:
                conn.rollback()
            self._last_success = False
            self._last_error = str(e)
            logger.error(f"Traffic refresh cycle failed: {e}")
            raise
        finally:
            self._refresh_in_progress = False
            if conn is not None:
                conn.close()

    @staticmethod
    def _fetch_latest_speeds():
        """Fetch the latest speed snapshot from the Socrata API."""
        query_params = urllib.parse.urlencode(
            {
                "$select": (
                    "link_id,speed,travel_time,"
                    "link_points,link_name,borough,data_as_of"
                ),
                "$where": "speed > '0'",
                "$order": "data_as_of DESC",
                "$limit": str(FETCH_LIMIT),
            }
        )
        url = f"{SOCRATA_BASE}?{query_params}"

        logger.info(
            "Fetching latest speed readings from NYC DOT "
            "Traffic Speeds NBE..."
        )
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

    @staticmethod
    def _parse_link_points(link_points_str):
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
                # Validate NYC bounding box
                if not (40.4 <= lat <= 41.0 and -74.3 <= lon <= -73.6):
                    continue
                coords.append(f"{lon} {lat}")
            except ValueError:
                continue

        if len(coords) < 2:
            return None

        return f"LINESTRING({', '.join(coords)})"

    def _create_speed_staging(self, cur, records):
        """Create temp staging table and insert speed records.

        Returns count of inserted records.
        """
        cur.execute(
            """
            CREATE TEMP TABLE IF NOT EXISTS _traffic_speeds (
                id SERIAL PRIMARY KEY,
                link_id BIGINT,
                speed NUMERIC(8,2),
                travel_time INTEGER,
                link_name TEXT,
                borough TEXT,
                geom GEOMETRY(LINESTRING, 4326)
            ) ON COMMIT DROP;
            """
        )
        cur.execute("TRUNCATE _traffic_speeds;")

        inserted = 0
        skipped = 0
        for rec in records:
            wkt = self._parse_link_points(rec.get("link_points", ""))
            if wkt is None:
                skipped += 1
                continue

            speed = float(rec.get("speed", 0))
            travel_time = int(float(rec.get("travel_time", 0)))

            cur.execute(
                """
                INSERT INTO _traffic_speeds
                    (link_id, speed, travel_time, link_name, borough, geom)
                VALUES
                    (%s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326))
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

        if skipped:
            logger.debug(f"Skipped {skipped} records with invalid geometry")
        return inserted

    def _match_speeds_to_edges(self, cur):
        """Spatially match speed links to LION edges within buffer.

        Returns count of unique matched edges.
        """
        cur.execute(
            f"""
            CREATE TEMP TABLE _speed_edge_mapping ON COMMIT DROP AS
            SELECT DISTINCT ON (ts.link_id, e.id)
                ts.link_id,
                e.id AS edge_id,
                ts.speed AS observed_speed,
                COALESCE(
                    NULLIF(e.posted_speed, 0), {DEFAULT_POSTED_SPEED}
                ) AS posted_speed,
                ST_Distance(
                    e.geom_4326::geography, ts.geom::geography
                ) AS distance
            FROM _traffic_speeds ts
            JOIN edges e
                ON ST_DWithin(
                    e.geom_4326::geography,
                    ts.geom::geography,
                    {MATCH_BUFFER_METERS}
                )
                AND e.driveable = TRUE
                AND TRIM(e.rw_type) != '1'
            ORDER BY
                ts.link_id, e.id,
                ST_Distance(e.geom_4326::geography, ts.geom::geography);
            """
        )

        cur.execute(
            "SELECT COUNT(*), COUNT(DISTINCT edge_id), "
            "COUNT(DISTINCT link_id) FROM _speed_edge_mapping;"
        )
        total_pairs, unique_edges, matched_links = cur.fetchone()
        logger.info(
            f"Spatial matching: {matched_links} speed links matched to "
            f"{unique_edges} edges ({total_pairs} total pairs)"
        )
        return unique_edges

    def _apply_traffic_factors_atomic(self, cur):
        """Compute and apply traffic factors atomically.

        Uses staging table + IS DISTINCT FROM to avoid the reset-all-to-1.0
        bug from the original import script. Only writes changed values and
        resets edges no longer covered by sensors in the same transaction.

        Returns total count of updated rows.
        """
        # Compute factors into staging table
        cur.execute(
            f"""
            CREATE TEMP TABLE _traffic_factor_staging ON COMMIT DROP AS
            SELECT
                edge_id,
                LEAST(GREATEST(
                    AVG(posted_speed) / NULLIF(AVG(observed_speed), 0),
                    {MIN_FACTOR}
                ), {MAX_FACTOR})::numeric(5,2) AS traffic_factor
            FROM _speed_edge_mapping
            GROUP BY edge_id;
            """
        )

        # Record edge count
        cur.execute("SELECT COUNT(*) FROM _traffic_factor_staging;")
        self._edge_count = cur.fetchone()[0]

        # Apply only changed values (incremental update)
        cur.execute(
            """
            UPDATE edges e
            SET traffic_factor = ts.traffic_factor
            FROM _traffic_factor_staging ts
            WHERE e.id = ts.edge_id
              AND e.traffic_factor IS DISTINCT FROM ts.traffic_factor;
            """
        )
        updated_count = cur.rowcount

        # Reset edges no longer covered by sensors
        cur.execute(
            """
            UPDATE edges
            SET traffic_factor = 1.0
            WHERE traffic_factor IS DISTINCT FROM 1.0
              AND driveable = TRUE
              AND id NOT IN (
                  SELECT edge_id FROM _traffic_factor_staging
              );
            """
        )
        reset_count = cur.rowcount

        logger.info(
            f"Traffic factors: {updated_count} edges updated, "
            f"{reset_count} edges reset to 1.0"
        )
        return updated_count + reset_count

    def _propagate_traffic_factors(self, cur, max_rounds=2):
        """Propagate traffic factors to nearby unmatched edges on same street.

        Speed link geometries are simplified (few points over miles of
        highway), so many LION edges along the corridor fall outside the
        match buffer. This fills gaps iteratively.

        Args:
            max_rounds: Maximum propagation rounds (2 for recurring, 5 for
                initial load).

        Returns:
            Total count of propagated edges.
        """
        total_propagated = 0
        for round_num in range(1, max_rounds + 1):
            cur.execute(
                """
                UPDATE edges gap
                SET traffic_factor = neighbor.avg_factor
                FROM (
                    SELECT gap_e.id,
                           AVG(matched_e.traffic_factor)::numeric(5,2)
                               AS avg_factor
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
                """
            )
            propagated = cur.rowcount
            total_propagated += propagated
            if propagated == 0:
                logger.info(
                    f"Propagation converged after {round_num} rounds"
                )
                break
            logger.info(
                f"  Round {round_num}: propagated to {propagated} edges"
            )

        logger.info(
            f"Propagated traffic_factor to {total_propagated} "
            f"total additional edges"
        )
        return total_propagated

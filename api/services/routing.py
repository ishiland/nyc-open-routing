import logging
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy import text
from sqlalchemy.engine import Engine
from fastapi import HTTPException

from utils.geo import parse_coordinates, dump_geo
from utils.clock import Clock
from utils.cache import get_route_cache
from models.schemas import (
    Feature, Properties, RouteResponse,
    WaypointRouteResponse, LegResponse, LegSummary, WaypointRouteSummary
)
from exceptions import InvalidCoordinatesError, RouteNotFoundError, DatabaseError

logger = logging.getLogger(__name__)

class RoutingService:
    def __init__(self, db_engine: Engine, sql_queries: Dict[str, str], clock: Clock):
        """
        Initialize the routing service.

        Args:
            db_engine: SQLAlchemy engine for database access
            sql_queries: Dictionary of SQL queries
            clock: Clock instance for time-based operations
        """
        self.engine = db_engine
        self.sql_queries = sql_queries
        self.clock = clock
        self.cache = get_route_cache()
        
    def get_driving_route(self, orig: str, dest: str, use_traffic: bool = True,
                          hour: Optional[int] = None, day_of_week: Optional[int] = None) -> RouteResponse:
        """
        Get a driving route between origin and destination coordinates.

        Args:
            orig: Origin coordinates in "lon,lat" format
            dest: Destination coordinates in "lon,lat" format
            use_traffic: Whether to use traffic-aware routing (default: True)
            hour: Hour of day for time-specific traffic (0-23), None = current time or static
            day_of_week: Day of week for time-specific traffic (1-7 Mon-Sun), None = current time or static

        Returns:
            RouteResponse containing GeoJSON Features representing the route segments

        Raises:
            HTTPException: If coordinates are invalid or error occurs
        """
        # Default to current time if traffic is enabled but no time specified
        if use_traffic and hour is None and day_of_week is None:
            hour = self.clock.hour
            # Convert Python weekday (0=Mon, 6=Sun) to SQL weekday (1=Mon, 7=Sun)
            day_of_week = self.clock.day_of_week + 1
            logger.info(f"Using current time for traffic: hour={hour}, day_of_week={day_of_week}")

        # Check cache first (cache key includes time parameters for time-specific routes)
        # Time-specific routes get unique cache keys to differentiate 168 time slots
        if hour is not None and day_of_week is not None:
            cache_key_suffix = f'traffic-h{hour}-d{day_of_week}' if use_traffic else 'no-traffic'
        else:
            cache_key_suffix = 'traffic-static' if use_traffic else 'no-traffic'

        cached_route = self.cache.get(orig, dest, f'drive-{cache_key_suffix}')
        if cached_route is not None:
            logger.info(f"Cache hit for driving route from {orig} to {dest} ({cache_key_suffix})")
            return RouteResponse(features=cached_route)

        # Parse coordinates
        try:
            orig_lon, orig_lat = parse_coordinates(orig)
            dest_lon, dest_lat = parse_coordinates(dest)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Execute routing query
        try:
            # Choose function based on use_traffic parameter
            if use_traffic:
                # Traffic-aware routing (dynamic time-based or static)
                sql = text("SELECT * FROM getdrivingroute_with_traffic(:orig_lat, :orig_lon, :dest_lat, :dest_lon, :hour, :day_of_week)")
                with self.engine.connect() as conn:
                    result = conn.execute(sql, {
                        "orig_lon": orig_lon,
                        "orig_lat": orig_lat,
                        "dest_lon": dest_lon,
                        "dest_lat": dest_lat,
                        "hour": hour,
                        "day_of_week": day_of_week
                    })
                    rows = result.fetchall()
            else:
                # Simple routing without traffic
                sql = text("SELECT * FROM getdrivingroute(:orig_lat, :orig_lon, :dest_lat, :dest_lon)")
                with self.engine.connect() as conn:
                    result = conn.execute(sql, {
                        "orig_lon": orig_lon,
                        "orig_lat": orig_lat,
                        "dest_lon": dest_lon,
                        "dest_lat": dest_lat
                    })
                    rows = result.fetchall()

            time_info = f"hour={hour}, day={day_of_week}" if hour and day_of_week else "static/current"
            logger.info(f"Found {len(rows)} route segments (traffic={'on' if use_traffic else 'off'}, {time_info})")

            # Validate traffic data availability
            if use_traffic and len(rows) > 0:
                # Check if all traffic_factor values are 1.0 (indicates no traffic data)
                traffic_factors = [row.traffic_factor for row in rows if hasattr(row, 'traffic_factor')]
                if traffic_factors and all(tf == 1.0 for tf in traffic_factors):
                    logger.warning(
                        "Traffic routing requested but no traffic data available (all traffic_factor=1.0). "
                        "Run import with --download-traffic flag to enable traffic-aware routing."
                    )

            # Check if route was found
            if len(rows) == 0:
                logger.warning(f"No route found between {orig} and {dest}")
                raise HTTPException(
                    status_code=404,
                    detail="No route found between these locations. This may be due to disconnected areas, grade separation restrictions, or invalid coordinates. Try different points or travel modes."
                )
        except HTTPException:
            raise  # Re-raise HTTP exceptions (including our 404)
        except Exception as e:
            logger.error(f"Error executing route query: {e}")
            # Check if error is due to missing traffic_factor column or time table
            if use_traffic and ("traffic_factor" in str(e) or "avg_traffic_by_segment" in str(e)):
                logger.warning("Traffic data not available, falling back to non-traffic routing")
                # Retry without traffic
                return self.get_driving_route(orig, dest, use_traffic=False, hour=None, day_of_week=None)
            raise HTTPException(status_code=500, detail="Error processing route request.")

        # Convert to GeoJSON Features
        features = self._format_route_response(rows, result, mode='drive')

        # Cache the result (time-specific or static)
        self.cache.set(orig, dest, f'drive-{cache_key_suffix}', features)

        return RouteResponse(features=features)

    def get_biking_route(self, orig: str, dest: str, avoid_ferries: bool = False) -> RouteResponse:
        """
        Get a biking route between origin and destination coordinates.

        Args:
            orig: Origin coordinates in "lon,lat" format
            dest: Destination coordinates in "lon,lat" format

        Returns:
            RouteResponse containing GeoJSON Features representing the route segments

        Raises:
            HTTPException: If coordinates are invalid or error occurs
        """
        # Check cache first
        cache_key = 'bike-no-ferry' if avoid_ferries else 'bike'
        cached_route = self.cache.get(orig, dest, cache_key)
        if cached_route is not None:
            logger.info(f"Cache hit for biking route from {orig} to {dest}")
            return RouteResponse(features=cached_route)

        # Parse coordinates
        try:
            orig_lon, orig_lat = parse_coordinates(orig)
            dest_lon, dest_lat = parse_coordinates(dest)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Execute routing query
        try:
            sql = text("SELECT * FROM getbikingroute(:orig_lat, :orig_lon, :dest_lat, :dest_lon, :avoid_ferries)")
            with self.engine.connect() as conn:
                result = conn.execute(sql, {
                    "orig_lon": orig_lon,
                    "orig_lat": orig_lat,
                    "dest_lon": dest_lon,
                    "dest_lat": dest_lat,
                    "avoid_ferries": avoid_ferries
                })
                rows = result.fetchall()
                logger.info(f"Found {len(rows)} route segments for biking (avoid_ferries={avoid_ferries})")

            # Check if route was found
            if len(rows) == 0:
                logger.warning(f"No biking route found between {orig} and {dest}")
                detail = "No route found between these locations."
                if avoid_ferries:
                    detail += " Try disabling 'Avoid ferries' — a ferry may be required to connect these areas."
                raise HTTPException(status_code=404, detail=detail)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error executing biking route query: {e}")
            raise HTTPException(status_code=500, detail="Error processing biking route request.")

        # Convert to GeoJSON Features
        features = self._format_route_response(rows, result, mode='bike')

        # Cache the result
        self.cache.set(orig, dest, cache_key, features)

        return RouteResponse(features=features)

    def get_walking_route(self, orig: str, dest: str, avoid_ferries: bool = False) -> RouteResponse:
        """
        Get a walking route between origin and destination coordinates.

        Args:
            orig: Origin coordinates in "lon,lat" format
            dest: Destination coordinates in "lon,lat" format

        Returns:
            RouteResponse containing GeoJSON Features representing the route segments

        Raises:
            HTTPException: If coordinates are invalid or error occurs
        """
        # Check cache first
        cache_key = 'walk-no-ferry' if avoid_ferries else 'walk'
        cached_route = self.cache.get(orig, dest, cache_key)
        if cached_route is not None:
            logger.info(f"Cache hit for walking route from {orig} to {dest}")
            return RouteResponse(features=cached_route)

        # Parse coordinates
        try:
            orig_lon, orig_lat = parse_coordinates(orig)
            dest_lon, dest_lat = parse_coordinates(dest)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Execute routing query
        try:
            sql = text("SELECT * FROM getwalkingroute(:orig_lat, :orig_lon, :dest_lat, :dest_lon, :avoid_ferries)")
            with self.engine.connect() as conn:
                result = conn.execute(sql, {
                    "orig_lon": orig_lon,
                    "orig_lat": orig_lat,
                    "dest_lon": dest_lon,
                    "dest_lat": dest_lat,
                    "avoid_ferries": avoid_ferries
                })
                rows = result.fetchall()
                logger.info(f"Found {len(rows)} route segments for walking (avoid_ferries={avoid_ferries})")

            # Check if route was found
            if len(rows) == 0:
                logger.warning(f"No walking route found between {orig} and {dest}")
                detail = "No route found between these locations."
                if avoid_ferries:
                    detail += " Try disabling 'Avoid ferries' — a ferry may be required to connect these areas."
                raise HTTPException(status_code=404, detail=detail)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error executing walking route query: {e}")
            raise HTTPException(status_code=500, detail="Error processing walking route request.")

        # Convert to GeoJSON Features
        features = self._format_route_response(rows, result, mode='walk')

        # Cache the result
        self.cache.set(orig, dest, cache_key, features)

        return RouteResponse(features=features)

    def get_waypoint_route(
        self,
        waypoints: List[str],
        mode: str,
        use_traffic: bool = True,
        avoid_ferries: bool = False,
        hour: Optional[int] = None,
        day_of_week: Optional[int] = None
    ) -> WaypointRouteResponse:
        """
        Get a multi-stop route through a list of waypoints.

        Orchestrates per-leg routing by calling existing mode-specific methods
        for each consecutive pair of waypoints.

        Args:
            waypoints: List of coordinate strings in "lon,lat" format (minimum 3)
            mode: Travel mode ('drive', 'bike', 'walk')
            use_traffic: Whether to use traffic-aware routing (drive mode only)
            avoid_ferries: Whether to avoid ferry routes (bike/walk modes)
            hour: Hour of day for time-specific traffic (0-23)
            day_of_week: Day of week for time-specific traffic (1-7 Mon-Sun)

        Returns:
            WaypointRouteResponse with per-leg features and summaries

        Raises:
            HTTPException: If any leg cannot be routed or an error occurs
        """
        # Build cache key
        waypoints_str = "|".join(waypoints)
        if mode == "drive":
            if hour is not None and day_of_week is not None:
                cache_suffix = f"traffic-h{hour}-d{day_of_week}" if use_traffic else "no-traffic"
            else:
                cache_suffix = "traffic-static" if use_traffic else "no-traffic"
            cache_key = f"waypoint-drive-{cache_suffix}"
        elif mode == "bike":
            cache_key = "waypoint-bike-no-ferry" if avoid_ferries else "waypoint-bike"
        elif mode == "walk":
            cache_key = "waypoint-walk-no-ferry" if avoid_ferries else "waypoint-walk"
        else:
            cache_key = f"waypoint-{mode}"

        # Check cache
        cached = self.cache.get(waypoints_str, "", cache_key)
        if cached is not None:
            logger.info(f"Cache hit for waypoint route ({cache_key})")
            return WaypointRouteResponse(**cached) if isinstance(cached, dict) else cached

        try:
            legs = []
            total_distance = 0.0
            total_time = 0.0

            for i in range(len(waypoints) - 1):
                orig = waypoints[i]
                dest = waypoints[i + 1]

                # Dispatch to existing mode-specific methods
                if mode == "drive":
                    leg_response = self.get_driving_route(
                        orig, dest,
                        use_traffic=use_traffic,
                        hour=hour,
                        day_of_week=day_of_week
                    )
                elif mode == "bike":
                    leg_response = self.get_biking_route(orig, dest, avoid_ferries=avoid_ferries)
                elif mode == "walk":
                    leg_response = self.get_walking_route(orig, dest, avoid_ferries=avoid_ferries)
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unsupported travel mode: {mode}"
                    )

                # Validate leg has segments
                if len(leg_response.features) == 0:
                    raise HTTPException(
                        status_code=404,
                        detail=(
                            f"No route found for leg {i + 1} "
                            f"(waypoint {i + 1} to waypoint {i + 2}). "
                            f"The entire route cannot be calculated."
                        )
                    )

                # Compute per-leg totals
                leg_distance = sum(
                    f.properties.distance or 0 for f in leg_response.features
                )
                leg_time = sum(
                    f.properties.travel_time or 0 for f in leg_response.features
                )

                legs.append(LegResponse(
                    leg=i,
                    summary=LegSummary(distance=leg_distance, travel_time=leg_time),
                    features=leg_response.features
                ))
                total_distance += leg_distance
                total_time += leg_time

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing waypoint route: {e}")
            raise HTTPException(
                status_code=500,
                detail="Error processing waypoint route request."
            )

        response = WaypointRouteResponse(
            legs=legs,
            summary=WaypointRouteSummary(
                total_distance=total_distance,
                total_travel_time=total_time,
                num_legs=len(legs)
            )
        )

        # Cache the result
        self.cache.set(waypoints_str, "", cache_key, response)

        return response

    def _format_route_response(self, rows, result, mode: str = 'drive') -> List[Feature]:
        """Format database result into a list of GeoJSON Features.

        Args:
            rows: Database result rows
            result: SQLAlchemy result object
            mode: Travel mode ('drive', 'bike', 'walk')
        """
        features = []
        for row in rows:
            # Convert row to dict
            try:
                row_dict = self._row_to_dict(row, result)
            except Exception as e:
                logger.warning(f"Error converting row to dict: {e}, using empty dict")
                row_dict = {}

            # Ensure all expected fields exist with defaults
            expected_fields = ['seq', 'street', 'distance', 'travel_time', 'turn_instruction', 'turn_type', 'traffic_factor', 'geom']
            for field in expected_fields:
                if field not in row_dict:
                    row_dict[field] = None

            # traffic_factor only applies to driving mode
            if mode in ('bike', 'walk'):
                traffic_factor_value = None
            else:
                traffic_factor_value = row_dict.get('traffic_factor', 1.0)  # Default to 1.0 (no traffic) if missing

            feature = Feature(
                properties=Properties(
                    seq=row_dict.get('seq', 0),
                    street=row_dict.get('street'),
                    distance=row_dict.get('distance'),
                    travel_time=row_dict.get('travel_time'),
                    turn_instruction=row_dict.get('turn_instruction'),
                    turn_type=row_dict.get('turn_type'),
                    traffic_factor=traffic_factor_value
                ),
                geometry=dump_geo(row_dict.get('geom'))
            )
            features.append(feature)
        return features
        
    @staticmethod
    def _row_to_dict(row, result) -> Dict[str, Any]:
        """
        Convert a database row to a dictionary.
        
        This function handles different types of row objects that SQLAlchemy might return,
        normalizing them to a standard dictionary format.
        """
        # For SQLAlchemy 1.4+ Row objects, use _mapping
        if hasattr(row, '_mapping'):
            return dict(row._mapping)
        
        # For namedtuple-like objects
        if hasattr(row, '_asdict'):
            return row._asdict()
            
        # For dictionary-like objects
        if hasattr(row, 'keys'):
            return {key: row[key] for key in row.keys()}
            
        # Fallback - map positions to column names
        row_dict = {}
        if hasattr(result, 'keys'):
            keys = result.keys()
            for i, key in enumerate(keys):
                if i < len(row):
                    row_dict[key] = row[i]
        return row_dict 
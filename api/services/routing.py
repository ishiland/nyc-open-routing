import logging
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy import text
from sqlalchemy.engine import Engine
from fastapi import HTTPException

from utils.geo import parse_coordinates, dump_geo
from utils.clock import Clock
from utils.cache import get_route_cache
from models.schemas import Feature, Properties, RouteResponse
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
        
    def get_driving_route(self, orig: str, dest: str, use_traffic: bool = True) -> RouteResponse:
        """
        Get a driving route between origin and destination coordinates.

        Args:
            orig: Origin coordinates in "lon,lat" format
            dest: Destination coordinates in "lon,lat" format
            use_traffic: Whether to use traffic-aware routing (default: True)

        Returns:
            RouteResponse containing GeoJSON Features representing the route segments

        Raises:
            HTTPException: If coordinates are invalid or error occurs
        """
        # Check cache first (cache key differentiates traffic vs non-traffic via use_traffic)
        # Note: Traffic factors are static, not time-dependent
        cache_key_suffix = 'traffic' if use_traffic else 'no-traffic'
        cached_route = self.cache.get(orig, dest, f'drive-{cache_key_suffix}')
        if cached_route is not None:
            logger.info(f"Cache hit for driving route from {orig} to {dest} (traffic={'on' if use_traffic else 'off'})")
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
                # Traffic-aware routing (uses static traffic_factor from edges table)
                sql = text("SELECT * FROM getdrivingroute_with_traffic(:orig_lat, :orig_lon, :dest_lat, :dest_lon)")
                with self.engine.connect() as conn:
                    result = conn.execute(sql, {
                        "orig_lon": orig_lon,
                        "orig_lat": orig_lat,
                        "dest_lon": dest_lon,
                        "dest_lat": dest_lat
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

            logger.info(f"Found {len(rows)} route segments (traffic={'on' if use_traffic else 'off'})")

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
            # Check if error is due to missing traffic_factor column
            if use_traffic and "traffic_factor" in str(e):
                logger.warning("Traffic data not available, falling back to non-traffic routing")
                # Retry without traffic
                return self.get_driving_route(orig, dest, use_traffic=False)
            raise HTTPException(status_code=500, detail="Error processing route request.")

        # Convert to GeoJSON Features
        features = self._format_route_response(rows, result, mode='drive')

        # Cache the result (static traffic, no time variance)
        self.cache.set(orig, dest, f'drive-{cache_key_suffix}', features)

        return RouteResponse(features=features)

    def get_biking_route(self, orig: str, dest: str) -> RouteResponse:
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
        cached_route = self.cache.get(orig, dest, 'bike')
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
            sql = text("SELECT * FROM getbikingroute(:orig_lat, :orig_lon, :dest_lat, :dest_lon)")
            with self.engine.connect() as conn:
                result = conn.execute(sql, {
                    "orig_lon": orig_lon,
                    "orig_lat": orig_lat,
                    "dest_lon": dest_lon,
                    "dest_lat": dest_lat
                })
                rows = result.fetchall()
                logger.info(f"Found {len(rows)} route segments for biking")
        except Exception as e:
            logger.error(f"Error executing biking route query: {e}")
            raise HTTPException(status_code=500, detail="Error processing biking route request.")

        # Convert to GeoJSON Features
        features = self._format_route_response(rows, result, mode='bike')

        # Cache the result
        self.cache.set(orig, dest, 'bike', features)

        return RouteResponse(features=features)

    def get_walking_route(self, orig: str, dest: str) -> RouteResponse:
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
        cached_route = self.cache.get(orig, dest, 'walk')
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
            sql = text("SELECT * FROM getwalkingroute(:orig_lat, :orig_lon, :dest_lat, :dest_lon)")
            with self.engine.connect() as conn:
                result = conn.execute(sql, {
                    "orig_lon": orig_lon,
                    "orig_lat": orig_lat,
                    "dest_lon": dest_lon,
                    "dest_lat": dest_lat
                })
                rows = result.fetchall()
                logger.info(f"Found {len(rows)} route segments for walking")
        except Exception as e:
            logger.error(f"Error executing walking route query: {e}")
            raise HTTPException(status_code=500, detail="Error processing walking route request.")

        # Convert to GeoJSON Features
        features = self._format_route_response(rows, result, mode='walk')

        # Cache the result
        self.cache.set(orig, dest, 'walk', features)

        return RouteResponse(features=features)

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
            expected_fields = ['seq', 'street', 'distance', 'travel_time', 'traffic_factor', 'geom']
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
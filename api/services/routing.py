import logging
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy import text
from sqlalchemy.engine import Engine
from fastapi import HTTPException

from utils.geo import parse_coordinates, dump_geo
from utils.clock import Clock
from models.schemas import Feature, Properties

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
        
    def get_driving_route(self, orig: str, dest: str) -> List[Feature]:
        """
        Get a driving route between origin and destination coordinates.
        
        Args:
            orig: Origin coordinates in "lon,lat" format
            dest: Destination coordinates in "lon,lat" format
            
        Returns:
            List of GeoJSON Features representing the route segments
            
        Raises:
            HTTPException: If coordinates are invalid or error occurs
        """
        # Get current time for traffic data
        hour = self.clock.hour
        day_of_week = self.clock.day_of_week
        
        # Parse coordinates
        try:
            orig_lon, orig_lat = parse_coordinates(orig)
            dest_lon, dest_lat = parse_coordinates(dest)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
        # Execute routing query
        try:
            # Use SQL query from file if available, otherwise fallback to inline query
            sql_query = self.sql_queries.get('routing', 
                "SELECT * FROM getdrivingroute_with_traffic(:orig_lon, :orig_lat, :dest_lon, :dest_lat, :hour, :day_of_week)")
            
            sql = text(sql_query)
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
                logger.info(f"Found {len(rows)} route segments")
        except Exception as e:
            logger.error(f"Error executing route query: {e}")
            raise HTTPException(status_code=500, detail="Error processing route request.")
        
        # Convert to GeoJSON Features
        return self._format_route_response(rows, result)
    
    def _format_route_response(self, rows, result) -> List[Feature]:
        """Format database result into a list of GeoJSON Features."""
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
                    
            feature = Feature(
                properties=Properties(
                    seq=row_dict.get('seq', 0),
                    street=row_dict.get('street'),
                    distance=row_dict.get('distance'),
                    travel_time=row_dict.get('travel_time'),
                    traffic_factor=row_dict.get('traffic_factor', 1.0)  # Default to 1.0 (no traffic) if missing
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
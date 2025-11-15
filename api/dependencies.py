import os
from typing import Generator, Dict, Any
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
import pathlib
import pytz
from geosupport import Geosupport
from suggest import GeosupportSuggest

from config.settings import settings
from services.routing import RoutingService
from services.search import SearchService
from utils.clock import Clock

# Load SQL queries from files
def load_sql_queries() -> Dict[str, str]:
    """
    Load SQL queries from the sql directory.
    
    Returns:
        Dictionary mapping query names to SQL strings
    """
    queries = {}
    sql_dir = pathlib.Path(__file__).parent / "sql"
    
    if sql_dir.exists():
        for sql_file in sql_dir.glob("*.sql"):
            query_name = sql_file.stem
            with open(sql_file, "r") as f:
                queries[query_name] = f.read()
    
    return queries

# Create shared instances with connection pooling
_db_engine = create_engine(
    settings.DATABASE_URI,
    pool_size=5,                # Number of permanent connections
    max_overflow=10,            # Max connections beyond pool_size
    pool_timeout=30,            # Seconds to wait for connection
    pool_recycle=3600,          # Recycle connections after 1 hour
    pool_pre_ping=True,         # Test connections before using
    echo=False                  # Set to True for SQL debugging
)
_sql_queries = load_sql_queries()
_clock = Clock(tz=pytz.timezone('America/New_York'))

# Geosupport instances (singleton pattern for performance)
_geosupport = Geosupport()
_geosupport_suggest = GeosupportSuggest(_geosupport)

# Services
_routing_service = RoutingService(_db_engine, _sql_queries, _clock)
_search_service = SearchService(_geosupport_suggest)

def get_db_engine() -> Engine:
    """
    Get the SQLAlchemy database engine.
    """
    return _db_engine

def get_sql_queries() -> Dict[str, str]:
    """
    Get the loaded SQL queries.
    """
    return _sql_queries

def get_clock() -> Clock:
    """
    Get the clock instance.
    """
    return _clock

def get_routing_service() -> RoutingService:
    """
    Get the routing service.
    """
    return _routing_service

def get_search_service() -> SearchService:
    """
    Get the address search service.
    """
    return _search_service

def get_geosupport() -> Geosupport:
    """
    Get the Geosupport instance.
    """
    return _geosupport

def get_geosupport_suggest() -> GeosupportSuggest:
    """
    Get the GeosupportSuggest instance.
    """
    return _geosupport_suggest 
import os
from typing import Generator, Dict, Any
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
import pathlib

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

# Create shared instances
_db_engine = create_engine(settings.DATABASE_URI)
_sql_queries = load_sql_queries()
_clock = Clock()

# Services
_routing_service = RoutingService(_db_engine, _sql_queries, _clock)
_search_service = SearchService()

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
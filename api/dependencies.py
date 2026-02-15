import pathlib
from typing import Dict

import pytz
from geosupport import Geosupport
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from suggest import GeosupportSuggest

from config.settings import settings
from services.isochrone import IsochroneService
from services.routing import RoutingService
from services.search import SearchService
from services.traffic import TrafficRefreshService
from utils.cache import get_route_cache, get_tile_cache
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
    pool_size=20,
    max_overflow=30,
    pool_timeout=10,
    pool_recycle=1800,
    pool_pre_ping=True,
    echo=False,
)
_sql_queries = load_sql_queries()
_clock = Clock(tz=pytz.timezone("America/New_York"))

# Geosupport instances (singleton pattern for performance)
_geosupport = Geosupport()
_geosupport_suggest = GeosupportSuggest(_geosupport)

# Services
_routing_service = RoutingService(_db_engine, _sql_queries, _clock)
_search_service = SearchService(_geosupport_suggest)
_isochrone_service = IsochroneService(_db_engine, _clock)

# Traffic service (only created when enabled)
_traffic_service = None
if settings.TRAFFIC_ENABLED:
    _traffic_service = TrafficRefreshService(
        db_params=settings.DB_PARAMS,
        interval_seconds=settings.TRAFFIC_REFRESH_INTERVAL,
        route_cache=get_route_cache(),
        tile_cache=get_tile_cache(),
    )


def get_db_engine() -> Engine:
    """
    Get the SQLAlchemy database engine.
    """
    return _db_engine


def get_routing_service() -> RoutingService:
    """
    Get the routing service.
    """
    return _routing_service


def get_isochrone_service() -> IsochroneService:
    """
    Get the isochrone service.
    """
    return _isochrone_service


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


def get_traffic_service():
    """
    Get the traffic refresh service (None if traffic is disabled).
    """
    return _traffic_service

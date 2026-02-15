from unittest.mock import MagicMock

import pytest

from services.routing import RoutingService
from utils.cache import get_route_cache


@pytest.fixture(autouse=True)
def clear_route_cache():
    """Clear the global route cache before each test to prevent cross-test contamination."""
    get_route_cache().clear()


@pytest.fixture
def mock_db_engine():
    """Mock SQLAlchemy engine."""
    engine = MagicMock()
    return engine


@pytest.fixture
def mock_sql_queries():
    """Mock SQL queries dictionary."""
    return {
        "routing": (
            "SELECT * FROM getdrivingroute_with_traffic"
            "(:orig_lon, :orig_lat, :dest_lon, :dest_lat)"
        )
    }


@pytest.fixture
def mock_routing_service(mock_db_engine, mock_sql_queries):
    """Return a mocked RoutingService."""
    return RoutingService(mock_db_engine, mock_sql_queries)

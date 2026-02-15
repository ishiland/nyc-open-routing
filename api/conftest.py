import pytest
from unittest.mock import MagicMock
from datetime import datetime

from services.routing import RoutingService
from utils.clock import Clock
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
        "routing": "SELECT * FROM getdrivingroute_with_traffic(:orig_lon, :orig_lat, :dest_lon, :dest_lat, :hour, :day_of_week)"
    }

@pytest.fixture
def mock_clock():
    """Mock Clock class."""
    clock = MagicMock(spec=Clock)
    # Set default return values
    clock.hour = 12
    clock.day_of_week = 1
    clock.now.return_value = datetime(2023, 1, 1, 12, 0, 0)
    return clock

@pytest.fixture
def mock_routing_service(mock_db_engine, mock_sql_queries, mock_clock):
    """Return a mocked RoutingService."""
    return RoutingService(mock_db_engine, mock_sql_queries, mock_clock)


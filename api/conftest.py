import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy import create_engine
from fastapi.testclient import TestClient
from datetime import datetime

from api.main import app
from api.services.routing import RoutingService
from api.services.search import SearchService
from api.utils.clock import Clock

@pytest.fixture
def test_client():
    """Return a TestClient instance for the FastAPI app."""
    return TestClient(app)

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

@pytest.fixture
def mock_search_service():
    """Return a mocked SearchService."""
    service = MagicMock(spec=SearchService)
    # Configure the service's search_address method to be awaitable
    async def mock_search_address(address):
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "Borough": "MANHATTAN",
                        "ZipCode": "10007",
                        "StreetName": "BROADWAY"
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [-73.9857, 40.7484]
                    }
                }
            ]
        }
    service.search_address = mock_search_address
    return service 
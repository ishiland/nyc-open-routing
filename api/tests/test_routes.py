import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from api.main import app

client = TestClient(app)

def test_route_endpoint_invalid_mode():
    """Test route endpoint with invalid mode parameter."""
    response = client.get("/api/route?orig=-73.9857,40.7484&dest=-73.9950,40.7352&mode=invalid")
    assert response.status_code == 400
    assert "Invalid mode specified" in response.json()["detail"]

def test_route_endpoint_invalid_coordinates():
    """Test route endpoint with invalid coordinate format."""
    response = client.get("/api/route?orig=invalid&dest=-73.9950,40.7352&mode=drive")
    assert response.status_code == 400
    assert "Invalid coordinate format" in response.json()["detail"]

@patch('api.services.routing.RoutingService.get_driving_route')
def test_route_endpoint_success(mock_get_driving_route):
    """Test successful route retrieval."""
    # Mock response data
    mock_features = [
        {
            "properties": {
                "seq": 1, 
                "street": "BROADWAY", 
                "distance": 100.5, 
                "travel_time": 30.0,
                "traffic_factor": 1.2
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [-73.9857, 40.7484],
                    [-73.9855, 40.7480]
                ]
            }
        }
    ]
    mock_get_driving_route.return_value = mock_features
    
    # Test the endpoint
    response = client.get("/api/route?orig=-73.9857,40.7484&dest=-73.9950,40.7352&mode=drive")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["properties"]["street"] == "BROADWAY"

@patch('api.services.routing.RoutingService.get_biking_route')
def test_route_endpoint_bike_success(mock_get_biking_route):
    """Test successful bike route retrieval."""
    # Mock response data
    mock_features = [
        {
            "properties": {
                "seq": 1,
                "street": "9TH AVE",
                "distance": 150.0,
                "travel_time": 20.0,
                "traffic_factor": None
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [-73.9857, 40.7484],
                    [-73.9855, 40.7480]
                ]
            }
        }
    ]
    mock_get_biking_route.return_value = mock_features

    # Test the endpoint
    response = client.get("/api/route?orig=-73.9857,40.7484&dest=-73.9950,40.7352&mode=bike")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["properties"]["street"] == "9TH AVE"

@patch('api.services.routing.RoutingService.get_walking_route')
def test_route_endpoint_walk_success(mock_get_walking_route):
    """Test successful walking route retrieval."""
    # Mock response data
    mock_features = [
        {
            "properties": {
                "seq": 1,
                "street": "W 42ND ST",
                "distance": 50.0,
                "travel_time": 15.0,
                "traffic_factor": None
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [-73.9857, 40.7484],
                    [-73.9855, 40.7480]
                ]
            }
        }
    ]
    mock_get_walking_route.return_value = mock_features

    # Test the endpoint
    response = client.get("/api/route?orig=-73.9857,40.7484&dest=-73.9950,40.7352&mode=walk")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["properties"]["street"] == "W 42ND ST"

def test_route_endpoint_missing_origin():
    """Test route endpoint with missing origin parameter."""
    response = client.get("/api/route?dest=-73.9950,40.7352&mode=drive")
    assert response.status_code == 422  # FastAPI validation error

def test_route_endpoint_missing_destination():
    """Test route endpoint with missing destination parameter."""
    response = client.get("/api/route?orig=-73.9857,40.7484&mode=drive")
    assert response.status_code == 422  # FastAPI validation error

def test_route_endpoint_missing_mode():
    """Test route endpoint with missing mode parameter."""
    response = client.get("/api/route?orig=-73.9857,40.7484&dest=-73.9950,40.7352")
    assert response.status_code == 422  # FastAPI validation error

def test_address_search_success():
    """Test successful address search using real Geosupport."""
    # Test with a known NYC address
    response = client.get("/api/search?address=260 Broadway")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    # Results depend on Geosupport, but should return a valid structure

def test_address_search_missing_query():
    """Test address search with missing query parameter."""
    response = client.get("/api/search")
    assert response.status_code == 422  # FastAPI validation error


# --- Waypoint routing endpoint tests ---

@patch('api.services.routing.RoutingService.get_waypoint_route')
def test_waypoint_route_endpoint_success(mock_get_waypoint_route):
    """Test successful waypoint route retrieval."""
    from api.models.schemas import (
        WaypointRouteResponse, LegResponse, LegSummary,
        WaypointRouteSummary, Feature, Properties
    )

    mock_response = WaypointRouteResponse(
        legs=[LegResponse(
            leg=0,
            summary=LegSummary(distance=500.0, travel_time=10.0),
            features=[Feature(
                properties=Properties(seq=1, street="BROADWAY", distance=500.0, travel_time=10.0),
                geometry={"type": "LineString", "coordinates": [[-73.98, 40.75], [-73.99, 40.76]]}
            )]
        )],
        summary=WaypointRouteSummary(total_distance=500.0, total_travel_time=10.0, num_legs=1)
    )
    mock_get_waypoint_route.return_value = mock_response

    response = client.get(
        "/api/route/waypoints?waypoints=-73.9857,40.7484|-73.9950,40.7352&mode=drive"
    )
    assert response.status_code == 200
    data = response.json()
    assert "legs" in data
    assert "summary" in data
    assert len(data["legs"]) == 1
    assert data["summary"]["num_legs"] == 1


def test_waypoint_route_endpoint_too_few_waypoints():
    """Test waypoint endpoint rejects fewer than 2 waypoints."""
    response = client.get(
        "/api/route/waypoints?waypoints=-73.9857,40.7484&mode=drive"
    )
    assert response.status_code == 400
    assert "At least 2 waypoints" in response.json()["detail"]


def test_waypoint_route_endpoint_too_many_waypoints():
    """Test waypoint endpoint rejects more than 3 waypoints."""
    response = client.get(
        "/api/route/waypoints?waypoints=-73.98,40.75|-73.99,40.76|-74.00,40.77|-73.97,40.74&mode=drive"
    )
    assert response.status_code == 400
    assert "Maximum 3 waypoints" in response.json()["detail"]


def test_waypoint_route_endpoint_invalid_coordinates():
    """Test waypoint endpoint rejects invalid coordinate format."""
    response = client.get(
        "/api/route/waypoints?waypoints=invalid|-73.99,40.76&mode=drive"
    )
    assert response.status_code == 400
    assert "Invalid coordinate format" in response.json()["detail"]


def test_waypoint_route_endpoint_missing_waypoints():
    """Test waypoint endpoint requires waypoints parameter."""
    response = client.get("/api/route/waypoints?mode=drive")
    assert response.status_code == 422  # FastAPI validation error


def test_waypoint_route_endpoint_missing_mode():
    """Test waypoint endpoint requires mode parameter."""
    response = client.get(
        "/api/route/waypoints?waypoints=-73.98,40.75|-73.99,40.76"
    )
    assert response.status_code == 422  # FastAPI validation error


# --- Traffic tile endpoint tests ---

def test_traffic_tile_invalid_z_negative():
    """Test tile endpoint rejects negative z values."""
    response = client.get("/api/traffic/tiles/-1/0/0.pbf")
    assert response.status_code == 400
    assert "z must be 0-22" in response.json()["detail"]


def test_traffic_tile_invalid_z_too_large():
    """Test tile endpoint rejects z > 22."""
    response = client.get("/api/traffic/tiles/23/0/0.pbf")
    assert response.status_code == 400
    assert "z must be 0-22" in response.json()["detail"]


@patch('api.routes.traffic.get_tile_cache')
@patch('api.routes.traffic.get_db_engine')
def test_traffic_tile_cache_hit(mock_get_engine, mock_get_cache):
    """Test tile endpoint returns cached tile without hitting DB."""
    mock_cache = mock_get_cache.return_value
    mock_cache.get.return_value = b"\x1a\x00\x01"

    response = client.get("/api/traffic/tiles/14/4825/6157.pbf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-protobuf"
    assert response.headers["cache-control"] == "public, max-age=300"
    assert response.content == b"\x1a\x00\x01"
    mock_get_engine.assert_not_called()


@patch('api.routes.traffic.get_tile_cache')
@patch('api.routes.traffic.get_db_engine')
def test_traffic_tile_cache_miss_queries_db(mock_get_engine, mock_get_cache):
    """Test tile endpoint queries DB on cache miss and caches result."""
    mock_cache = mock_get_cache.return_value
    mock_cache.get.return_value = None

    mock_conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value
    mock_conn.execute.return_value.fetchone.return_value = (b"\x1a\x02\x03",)

    response = client.get("/api/traffic/tiles/14/4825/6157.pbf")

    assert response.status_code == 200
    assert response.content == b"\x1a\x02\x03"
    mock_cache.set.assert_called_once_with(14, 4825, 6157, b"\x1a\x02\x03")


@patch('api.routes.traffic.get_tile_cache')
@patch('api.routes.traffic.get_db_engine')
def test_traffic_tile_empty_result(mock_get_engine, mock_get_cache):
    """Test tile endpoint returns empty bytes when no data for tile."""
    mock_cache = mock_get_cache.return_value
    mock_cache.get.return_value = None

    mock_conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value
    mock_conn.execute.return_value.fetchone.return_value = (None,)

    response = client.get("/api/traffic/tiles/14/0/0.pbf")

    assert response.status_code == 200
    assert response.content == b""
    assert response.headers["content-type"] == "application/x-protobuf"


@patch('api.routes.traffic.get_tile_cache')
@patch('api.routes.traffic.get_db_engine')
def test_traffic_tile_no_row(mock_get_engine, mock_get_cache):
    """Test tile endpoint returns empty bytes when query returns no rows."""
    mock_cache = mock_get_cache.return_value
    mock_cache.get.return_value = None

    mock_conn = mock_get_engine.return_value.connect.return_value.__enter__.return_value
    mock_conn.execute.return_value.fetchone.return_value = None

    response = client.get("/api/traffic/tiles/14/0/0.pbf")

    assert response.status_code == 200
    assert response.content == b""


def test_traffic_tile_valid_z_boundary():
    """Test tile endpoint accepts z=0 and z=22 (boundary values)."""
    # These will fail at DB level but should pass z validation
    with patch('api.routes.traffic.get_tile_cache') as mock_cache, \
         patch('api.routes.traffic.get_db_engine') as mock_engine:
        mock_cache.return_value.get.return_value = b""

        response_z0 = client.get("/api/traffic/tiles/0/0/0.pbf")
        assert response_z0.status_code == 200

        response_z22 = client.get("/api/traffic/tiles/22/0/0.pbf")
        assert response_z22.status_code == 200
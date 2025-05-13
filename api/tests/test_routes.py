import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

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

@patch('api.services.search.SearchService.search_address')
def test_address_search_success(mock_search_address):
    """Test successful address search."""
    # Mock response data
    mock_response = {
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
    mock_search_address.return_value = mock_response
    
    # Test the endpoint
    response = client.get("/api/search?address=Broadway")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1
    assert data["features"][0]["properties"]["StreetName"] == "BROADWAY" 
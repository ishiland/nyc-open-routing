import pytest
from unittest.mock import MagicMock, patch

from api.services.routing import RoutingService
from api.services.search import SearchService
from fastapi import HTTPException

def test_routing_service_parse_error(mock_routing_service):
    """Test RoutingService with invalid coordinates."""
    with pytest.raises(HTTPException) as excinfo:
        mock_routing_service.get_driving_route("invalid", "-73.9950,40.7352")
    assert excinfo.value.status_code == 400
    assert "Invalid coordinate format" in str(excinfo.value.detail)

def test_routing_service_db_error(mock_routing_service, mock_db_engine):
    """Test RoutingService with database error."""
    # Mock the database to raise an exception
    conn = MagicMock()
    conn.execute.side_effect = Exception("Database error")
    mock_db_engine.connect.return_value.__enter__.return_value = conn
    
    with pytest.raises(HTTPException) as excinfo:
        mock_routing_service.get_driving_route("-73.9857,40.7484", "-73.9950,40.7352")
    assert excinfo.value.status_code == 500
    assert "Error processing route request" in str(excinfo.value.detail)

def test_routing_service_success(mock_routing_service, mock_db_engine):
    """Test successful route retrieval."""
    # Mock successful database response
    conn = MagicMock()
    result = MagicMock()
    rows = [
        MagicMock(
            _mapping={
                "seq": 1,
                "street": "BROADWAY",
                "distance": 100.5,
                "travel_time": 30.0,
                "traffic_factor": 1.2,
                "geom": "0102000000020000000000000000405EC0CDCCCCCCCC104440000000000040"
            }
        )
    ]
    result.fetchall.return_value = rows
    conn.execute.return_value = result
    mock_db_engine.connect.return_value.__enter__.return_value = conn
    
    # Patch the dump_geo function to return a simple geometry
    with patch('api.utils.geo.dump_geo') as mock_dump_geo:
        mock_dump_geo.return_value = {
            "type": "LineString",
            "coordinates": [[-73.9857, 40.7484], [-73.9855, 40.7480]]
        }
        
        # Test the service
        features = mock_routing_service.get_driving_route("-73.9857,40.7484", "-73.9950,40.7352")
        
        # Verify results
        assert len(features) == 1
        assert features[0].properties.seq == 1
        assert features[0].properties.street == "BROADWAY"
        assert features[0].properties.distance == 100.5
        assert features[0].properties.travel_time == 30.0
        assert features[0].properties.traffic_factor == 1.2
        assert features[0].geometry["type"] == "LineString"

def test_search_service_error(mock_search_service):
    """Test SearchService with error from Geosupport."""
    # Mock the suggest object to raise an exception
    mock_search_service.suggest.suggestions.side_effect = Exception("Geosupport error")
    
    with pytest.raises(HTTPException) as excinfo:
        mock_search_service.search_address("Broadway")
    assert excinfo.value.status_code == 500
    assert "Error processing address search" in str(excinfo.value.detail)

def test_search_service_success(mock_search_service):
    """Test successful address search."""
    # Mock response data
    mock_suggestions = ["suggestion1", "suggestion2"]
    mock_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"StreetName": "BROADWAY"},
                "geometry": {"type": "Point", "coordinates": [-73.9857, 40.7484]}
            }
        ]
    }
    
    # Configure mocks
    mock_search_service.suggest.suggestions.return_value = mock_suggestions
    mock_search_service.suggest.to_geojson.return_value = mock_geojson
    
    # Test the service
    result = mock_search_service.search_address("Broadway")
    
    # Verify results
    assert result == mock_geojson
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 1
    assert result["features"][0]["properties"]["StreetName"] == "BROADWAY" 
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

def test_routing_service_biking_success(mock_routing_service, mock_db_engine):
    """Test successful biking route retrieval."""
    # Mock successful database response
    conn = MagicMock()
    result = MagicMock()
    rows = [
        MagicMock(
            _mapping={
                "seq": 1,
                "street": "9TH AVE",
                "distance": 150.0,
                "travel_time": 20.0,
                "traffic_factor": None,  # Biking doesn't use traffic factor
                "geom": "0102000000020000000000000000405EC0CDCCCCCCCC104440000000000040"
            }
        )
    ]
    result.fetchall.return_value = rows
    conn.execute.return_value = result
    mock_db_engine.connect.return_value.__enter__.return_value = conn

    # Patch the dump_geo function
    with patch('api.utils.geo.dump_geo') as mock_dump_geo:
        mock_dump_geo.return_value = {
            "type": "LineString",
            "coordinates": [[-73.9857, 40.7484], [-73.9855, 40.7480]]
        }

        # Test the service
        features = mock_routing_service.get_biking_route("-73.9857,40.7484", "-73.9950,40.7352")

        # Verify results
        assert len(features) == 1
        assert features[0].properties.seq == 1
        assert features[0].properties.street == "9TH AVE"
        assert features[0].properties.distance == 150.0
        assert features[0].properties.travel_time == 20.0
        assert features[0].geometry["type"] == "LineString"

def test_routing_service_walking_success(mock_routing_service, mock_db_engine):
    """Test successful walking route retrieval."""
    # Mock successful database response
    conn = MagicMock()
    result = MagicMock()
    rows = [
        MagicMock(
            _mapping={
                "seq": 1,
                "street": "W 42ND ST",
                "distance": 50.0,
                "travel_time": 15.0,
                "traffic_factor": None,  # Walking doesn't use traffic factor
                "geom": "0102000000020000000000000000405EC0CDCCCCCCCC104440000000000040"
            }
        )
    ]
    result.fetchall.return_value = rows
    conn.execute.return_value = result
    mock_db_engine.connect.return_value.__enter__.return_value = conn

    # Patch the dump_geo function
    with patch('api.utils.geo.dump_geo') as mock_dump_geo:
        mock_dump_geo.return_value = {
            "type": "LineString",
            "coordinates": [[-73.9857, 40.7484], [-73.9855, 40.7480]]
        }

        # Test the service
        features = mock_routing_service.get_walking_route("-73.9857,40.7484", "-73.9950,40.7352")

        # Verify results
        assert len(features) == 1
        assert features[0].properties.seq == 1
        assert features[0].properties.street == "W 42ND ST"
        assert features[0].properties.distance == 50.0
        assert features[0].properties.travel_time == 15.0
        assert features[0].geometry["type"] == "LineString"

def test_routing_service_biking_parse_error(mock_routing_service):
    """Test biking route with invalid coordinates."""
    with pytest.raises(HTTPException) as excinfo:
        mock_routing_service.get_biking_route("invalid", "-73.9950,40.7352")
    assert excinfo.value.status_code == 400
    assert "Invalid coordinate format" in str(excinfo.value.detail)

def test_routing_service_walking_parse_error(mock_routing_service):
    """Test walking route with invalid coordinates."""
    with pytest.raises(HTTPException) as excinfo:
        mock_routing_service.get_walking_route("-73.9857,40.7484", "invalid")
    assert excinfo.value.status_code == 400
    assert "Invalid coordinate format" in str(excinfo.value.detail)

def test_routing_service_biking_db_error(mock_routing_service, mock_db_engine):
    """Test biking route with database error."""
    # Mock the database to raise an exception
    conn = MagicMock()
    conn.execute.side_effect = Exception("Database error")
    mock_db_engine.connect.return_value.__enter__.return_value = conn

    with pytest.raises(HTTPException) as excinfo:
        mock_routing_service.get_biking_route("-73.9857,40.7484", "-73.9950,40.7352")
    assert excinfo.value.status_code == 500
    assert "Error processing biking route request" in str(excinfo.value.detail)

def test_routing_service_walking_db_error(mock_routing_service, mock_db_engine):
    """Test walking route with database error."""
    # Mock the database to raise an exception
    conn = MagicMock()
    conn.execute.side_effect = Exception("Database error")
    mock_db_engine.connect.return_value.__enter__.return_value = conn

    with pytest.raises(HTTPException) as excinfo:
        mock_routing_service.get_walking_route("-73.9857,40.7484", "-73.9950,40.7352")
    assert excinfo.value.status_code == 500
    assert "Error processing walking route request" in str(excinfo.value.detail)

@pytest.mark.asyncio
async def test_search_service_geosupport_error():
    """Test SearchService with Geosupport error."""
    from geosupport.error import GeosupportError

    # Create mock GeosupportSuggest
    mock_suggest = MagicMock()
    mock_suggest.suggestions.side_effect = GeosupportError("Address not recognized")

    service = SearchService(mock_suggest)

    with pytest.raises(HTTPException) as excinfo:
        await service.search_address("Invalid Address XYZ123")
    assert excinfo.value.status_code == 400
    assert "not recognized" in str(excinfo.value.detail).lower()

@pytest.mark.asyncio
async def test_search_service_success():
    """Test successful address search using Geosupport."""
    # Create mock suggestions data (format from geosupport-suggest library)
    mock_suggestions = [
        {
            "House Number - Display Format": "260",
            "First Street Name Normalized": "BROADWAY",
            "First Borough Name": "MANHATTAN",
            "Latitude": "40.7129",
            "Longitude": "-73.9997"
        },
        {
            "House Number - Display Format": "1555",
            "First Street Name Normalized": "BROADWAY",
            "First Borough Name": "MANHATTAN",
            "Latitude": "40.7580",
            "Longitude": "-73.9855"
        }
    ]

    # Mock GeoJSON response from to_geojson
    mock_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": mock_suggestions[0],
                "geometry": {"type": "Point", "coordinates": [-73.9997, 40.7129]}
            },
            {
                "type": "Feature",
                "properties": mock_suggestions[1],
                "geometry": {"type": "Point", "coordinates": [-73.9855, 40.7580]}
            }
        ]
    }

    # Create mock GeosupportSuggest
    mock_suggest = MagicMock()
    mock_suggest.suggestions.return_value = mock_suggestions
    mock_suggest.to_geojson.return_value = mock_geojson

    service = SearchService(mock_suggest)

    # Test the service
    result = await service.search_address("Broadway")

    # Verify results
    assert result == mock_geojson
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 2
    assert result["features"][0]["properties"]["First Street Name Normalized"] == "BROADWAY"

    # Verify the mock was called correctly
    mock_suggest.suggestions.assert_called_once_with("Broadway")
    mock_suggest.to_geojson.assert_called_once_with(mock_suggestions) 
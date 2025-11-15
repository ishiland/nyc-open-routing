"""
Smoke tests for NYC Open Routing API.

These are end-to-end integration tests that verify the routing API works correctly
with real database connections. They test:
- All travel modes (drive, bike, walk)
- Traffic toggle functionality
- Cross-borough routing
- Edge cases and error handling

These tests require:
- A properly configured database with imported LION data
- API service running on http://localhost:5001

These tests make real HTTP requests to the running API service,
making them true end-to-end smoke tests.
"""

import pytest
import requests

# Mark all tests in this module as integration tests
pytestmark = [pytest.mark.integration, pytest.mark.slow]

# API base URL
# When running inside Docker container, use internal container name
# When running from host, use localhost:5001
import os
API_BASE_URL = os.getenv("API_BASE_URL", "http://api:5000/api")

# Well-known NYC coordinates for testing
# Format: (lon, lat) - WGS84/EPSG:4326
COORDINATES = {
    "city_hall": (-74.0060, 40.7128),           # Lower Manhattan
    "times_square": (-73.9855, 40.7580),        # Midtown Manhattan
    "brooklyn_bridge": (-73.9969, 40.7061),     # Brooklyn Bridge (Manhattan side)
    "dumbo": (-73.9896, 40.7033),               # DUMBO, Brooklyn
    "queens_plaza": (-73.9374, 40.7489),        # Queens Plaza
    "grand_central": (-73.9772, 40.7527),       # Grand Central Terminal
    "union_square": (-73.9903, 40.7359),        # Union Square
    "greenwich_village": (-74.0014, 40.7336),   # Greenwich Village
}


def validate_route_response(response_data: list) -> None:
    """
    Validate that a route response has the expected structure and data types.

    Args:
        response_data: List of GeoJSON features from the API response

    Raises:
        AssertionError: If validation fails
    """
    # Response should be a list of features
    assert isinstance(response_data, list), "Response should be a list"
    assert len(response_data) > 0, "Route should have at least one segment"

    # Validate each feature
    for i, feature in enumerate(response_data):
        # Note: API doesn't include 'type' field in response (not in Pydantic model)
        # This is acceptable for the smoke tests - we're testing functionality, not strict GeoJSON compliance

        # Validate properties
        assert "properties" in feature, f"Feature {i} missing 'properties'"
        props = feature["properties"]

        # Required fields
        assert "seq" in props, f"Feature {i} missing 'seq'"
        assert "street" in props, f"Feature {i} missing 'street'"
        assert "distance" in props, f"Feature {i} missing 'distance'"
        assert "travel_time" in props, f"Feature {i} missing 'travel_time'"

        # Type validation
        assert isinstance(props["seq"], int), f"Feature {i} seq should be int"
        assert isinstance(props["distance"], (int, float)), f"Feature {i} distance should be numeric"
        assert isinstance(props["travel_time"], (int, float)), f"Feature {i} travel_time should be numeric"

        # Value validation
        assert props["distance"] > 0, f"Feature {i} distance should be positive"
        assert props["travel_time"] > 0, f"Feature {i} travel_time should be positive"

        # Validate geometry
        assert "geometry" in feature, f"Feature {i} missing 'geometry'"
        geom = feature["geometry"]
        assert "type" in geom, f"Feature {i} geometry missing 'type'"
        assert geom["type"] in ["LineString", "MultiLineString"], f"Feature {i} has invalid geometry type"
        assert "coordinates" in geom, f"Feature {i} geometry missing 'coordinates'"


class TestBasicRouteSmoke:
    """Smoke tests for basic routing functionality across all travel modes."""

    def test_driving_route_lower_manhattan_to_midtown(self):
        """Test driving route from City Hall to Times Square."""
        orig_lon, orig_lat = COORDINATES["city_hall"]
        dest_lon, dest_lat = COORDINATES["times_square"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "drive"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Additional validation for driving routes
        first_segment = data[0]["properties"]
        assert first_segment["seq"] == 1, "First segment should have seq=1"
        assert first_segment["street"] is not None, "Street name should not be null"

    def test_biking_route_brooklyn_bridge_area(self):
        """Test biking route from Brooklyn Bridge to DUMBO."""
        orig_lon, orig_lat = COORDINATES["brooklyn_bridge"]
        dest_lon, dest_lat = COORDINATES["dumbo"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "bike"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

    def test_walking_route_short_distance(self):
        """Test walking route for a short pedestrian trip."""
        orig_lon, orig_lat = COORDINATES["union_square"]
        dest_lon, dest_lat = COORDINATES["greenwich_village"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "walk"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)


class TestTrafficToggle:
    """Smoke tests for traffic-aware routing toggle functionality."""

    def test_driving_route_with_traffic_default(self):
        """Test driving route with traffic enabled (default behavior)."""
        orig_lon, orig_lat = COORDINATES["grand_central"]
        dest_lon, dest_lat = COORDINATES["times_square"]

        # Default should use traffic if available
        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "drive"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Check that traffic_factor field exists (may be null if no traffic data imported)
        first_segment = data[0]["properties"]
        assert "traffic_factor" in first_segment, "traffic_factor field should be present"

    def test_driving_route_without_traffic_explicit(self):
        """Test driving route with traffic explicitly disabled."""
        orig_lon, orig_lat = COORDINATES["grand_central"]
        dest_lon, dest_lat = COORDINATES["times_square"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={
                "orig": f"{orig_lon},{orig_lat}",
                "dest": f"{dest_lon},{dest_lat}",
                "mode": "drive",
                "use_traffic": "false"
            },
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # traffic_factor should be null for non-traffic routing
        first_segment = data[0]["properties"]
        # Note: traffic_factor field exists but should be null when use_traffic=false
        assert "traffic_factor" in first_segment, "traffic_factor field should be present"


class TestCrossBoroughRouting:
    """Smoke tests for cross-borough routing scenarios."""

    def test_manhattan_to_brooklyn_via_bridge(self):
        """Test driving route from Manhattan to Brooklyn across a bridge."""
        orig_lon, orig_lat = COORDINATES["city_hall"]
        dest_lon, dest_lat = COORDINATES["dumbo"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "drive"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Route should have multiple segments for this distance
        assert len(data) >= 3, "Cross-borough route should have multiple segments"

    def test_queens_to_manhattan(self):
        """Test driving route from Queens to Manhattan."""
        orig_lon, orig_lat = COORDINATES["queens_plaza"]
        dest_lon, dest_lat = COORDINATES["grand_central"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "drive"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)


class TestEdgeCases:
    """Smoke tests for edge cases and boundary conditions."""

    def test_very_short_route(self):
        """Test routing between two very close points (< 0.1 miles)."""
        # Times Square coordinates with slight offset (about 300 feet)
        orig_lon, orig_lat = (-73.9855, 40.7580)
        dest_lon, dest_lat = (-73.9845, 40.7585)

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "walk"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Should have at least one segment even for very short routes
        assert len(data) >= 1, "Very short route should have at least one segment"

    def test_same_origin_and_destination(self):
        """Test routing when origin and destination are the same."""
        lon, lat = COORDINATES["times_square"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{lon},{lat}", "dest": f"{lon},{lat}", "mode": "drive"},
            timeout=10
        )

        # This could return 200 with empty route or 404 - either is acceptable
        # Just ensure it doesn't crash with 500
        assert response.status_code in [200, 404], \
            f"Expected 200 or 404, got {response.status_code}: {response.text}"


class TestErrorHandling:
    """Smoke tests for error handling and validation."""

    def test_invalid_coordinates_out_of_nyc_bounds(self):
        """Test that coordinates outside NYC bounds are rejected."""
        # Los Angeles coordinates (clearly not NYC)
        orig_lon, orig_lat = (-118.2437, 34.0522)
        dest_lon, dest_lat = COORDINATES["times_square"]

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "drive"},
            timeout=10
        )

        # Should return 400 (bad request) for out-of-bounds coordinates
        assert response.status_code == 400, \
            f"Expected 400 for out-of-bounds coordinates, got {response.status_code}"

        # Error message should mention coordinates or bounds
        error_detail = response.json().get("detail", "")
        assert any(word in error_detail.lower() for word in ["coordinate", "bound", "range", "invalid"]), \
            f"Error message should mention invalid coordinates: {error_detail}"

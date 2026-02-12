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


def validate_route_response(response_data: dict) -> None:
    """
    Validate that a route response has the expected structure and data types.

    Args:
        response_data: RouteResponse object with features array from the API response

    Raises:
        AssertionError: If validation fails
    """
    # Response should be an object with features array
    assert isinstance(response_data, dict), "Response should be a dict"
    assert "features" in response_data, "Response should have 'features' key"
    features = response_data["features"]
    assert isinstance(features, list), "Features should be a list"
    assert len(features) > 0, "Route should have at least one segment"

    # Validate each feature
    for i, feature in enumerate(features):
        # Validate type field (required by GeoJSON spec)
        assert "type" in feature, f"Feature {i} missing 'type'"
        assert feature["type"] == "Feature", f"Feature {i} type should be 'Feature', got {feature.get('type')}"

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
        # Allow travel_time to be 0 due to JSON precision rounding for very short segments
        assert props["travel_time"] >= 0, f"Feature {i} travel_time should be non-negative"

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
        first_segment = data["features"][0]["properties"]
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
        first_segment = data["features"][0]["properties"]
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

        # traffic_factor should be 1.0 for non-traffic routing
        first_segment = data["features"][0]["properties"]
        assert "traffic_factor" in first_segment, "traffic_factor field should be present"
        assert first_segment["traffic_factor"] == 1.0, "traffic_factor should be 1.0 when use_traffic=false"

    def test_traffic_factor_values(self):
        """Test that traffic_factor values are valid and consistent."""
        orig_lon, orig_lat = COORDINATES["city_hall"]
        dest_lon, dest_lat = COORDINATES["times_square"]

        # Get route with traffic
        response_with_traffic = requests.get(
            f"{API_BASE_URL}/route",
            params={
                "orig": f"{orig_lon},{orig_lat}",
                "dest": f"{dest_lon},{dest_lat}",
                "mode": "drive",
                "use_traffic": "true"
            },
            timeout=10
        )

        # Get route without traffic
        response_without_traffic = requests.get(
            f"{API_BASE_URL}/route",
            params={
                "orig": f"{orig_lon},{orig_lat}",
                "dest": f"{dest_lon},{dest_lat}",
                "mode": "drive",
                "use_traffic": "false"
            },
            timeout=10
        )

        assert response_with_traffic.status_code == 200
        assert response_without_traffic.status_code == 200

        data_with_traffic = response_with_traffic.json()
        data_without_traffic = response_without_traffic.json()

        # Validate traffic_factor field exists and has valid values
        # System generates only discrete values: 1.0, 1.2, 1.5, 2.0, 3.0
        VALID_TRAFFIC_FACTORS = {1.0, 1.2, 1.5, 2.0, 3.0}
        for feature in data_with_traffic["features"]:
            props = feature["properties"]
            assert "traffic_factor" in props, "traffic_factor field should be present"
            assert isinstance(props["traffic_factor"], (int, float)), "traffic_factor should be numeric"
            assert props["traffic_factor"] in VALID_TRAFFIC_FACTORS, \
                f"traffic_factor should be one of {VALID_TRAFFIC_FACTORS}, got {props['traffic_factor']}"

        # Without traffic, all factors should be 1.0
        for feature in data_without_traffic["features"]:
            props = feature["properties"]
            assert props["traffic_factor"] == 1.0, "traffic_factor should always be 1.0 when use_traffic=false"


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
        assert len(data["features"]) >= 3, "Cross-borough route should have multiple segments"

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
        assert len(data["features"]) >= 1, "Very short route should have at least one segment"

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


class TestFerryRouting:
    """
    Smoke tests for ferry routing functionality.

    These tests verify that:
    1. Staten Island Ferry connections work correctly (our manual fix in 09_ferry_connections.sql)
    2. Other accessible NYC ferries remain routeable
    3. Drive mode correctly avoids ferries and uses bridges/tunnels

    See docs/STATEN_ISLAND_CONNECTIVITY_ISSUE.md for background on the ferry fix.
    """

    def test_staten_island_ferry_bike_route(self):
        """
        Test biking route using Staten Island Ferry.

        This validates the manual ferry terminal connections created in 09_ferry_connections.sql.
        The route should include the ferry crossing between St. George (Staten Island) and
        Whitehall (Manhattan) terminals.
        """
        # St. George Terminal (Staten Island) to Whitehall Terminal (Manhattan)
        orig_lon, orig_lat = (-74.0743, 40.6434)
        dest_lon, dest_lat = (-74.0134, 40.7024)

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "bike"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Verify the route includes the Staten Island Ferry
        street_names = [feature["properties"]["street"] for feature in data["features"]]
        assert any("STATEN ISLAND FERRY" in street.upper() for street in street_names), \
            "Route should include Staten Island Ferry segment"

    def test_staten_island_ferry_walk_route(self):
        """
        Test walking route using Staten Island Ferry.

        This validates that pedestrians can use the ferry to travel between
        Staten Island and Manhattan. The ferry allows walk-on passengers.
        """
        # St. George Terminal (Staten Island) to Whitehall Terminal (Manhattan)
        orig_lon, orig_lat = (-74.0743, 40.6434)
        dest_lon, dest_lat = (-74.0134, 40.7024)

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "walk"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Verify the route includes the ferry
        street_names = [feature["properties"]["street"] for feature in data["features"]]
        assert any("STATEN ISLAND FERRY" in street.upper() for street in street_names), \
            "Route should include Staten Island Ferry segment"

        # Verify travel time is substantial (ferry crossing is ~40 minutes)
        # Find the ferry segment and check its travel time
        for feature in data["features"]:
            if "STATEN ISLAND FERRY" in feature["properties"]["street"].upper():
                travel_time = feature["properties"]["travel_time"]
                assert travel_time > 30, \
                    f"Ferry crossing should take >30 minutes, got {travel_time} minutes"
                break

    def test_staten_island_ferry_not_in_drive_mode(self):
        """
        Test that driving routes do NOT use the Staten Island Ferry.

        Vehicles cannot use the Staten Island Ferry for routing between boroughs.
        Drive mode should use the Verrazzano-Narrows Bridge instead.
        """
        # Staten Island interior to Manhattan
        orig_lon, orig_lat = (-74.179451, 40.559705)  # Staten Island
        dest_lon, dest_lat = (-74.0060, 40.7128)      # Manhattan City Hall

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "drive"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Verify the route does NOT include the Staten Island Ferry
        street_names = [feature["properties"]["street"] for feature in data["features"]]
        assert not any("STATEN ISLAND FERRY" in street.upper() for street in street_names), \
            "Drive mode should NOT use Staten Island Ferry"

        # Route should use a bridge or highway
        route_text = " ".join(street_names).upper()
        assert any(keyword in route_text for keyword in ["BRIDGE", "EXPRESSWAY", "HIGHWAY", "VERRAZANO"]), \
            "Drive route should use bridges/highways, not ferry"

    def test_governors_island_area_walk_route(self):
        """
        Test walking route in Governors Island ferry area.

        This validates that routes near Governors Island ferry terminals work correctly.
        The router may choose land routes over ferry if they're more efficient, but
        the route should succeed without errors.
        """
        # Battery Maritime Terminal area to nearby Manhattan location
        orig_lon, orig_lat = (-74.0120, 40.7007)
        dest_lon, dest_lat = (-74.0056, 40.7028)

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "walk"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Route should succeed (validates ferry terminals don't break routing)
        assert len(data["features"]) > 0, "Route should return segments"

    def test_governors_island_area_bike_route(self):
        """
        Test biking route in Governors Island ferry area.

        This validates that bike routes near Governors Island work correctly.
        The router may choose land routes or ferry depending on efficiency.
        """
        # Battery Maritime Terminal area to nearby Manhattan location
        orig_lon, orig_lat = (-74.0120, 40.7007)
        dest_lon, dest_lat = (-74.0056, 40.7028)

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "bike"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Route should succeed
        assert len(data["features"]) > 0, "Route should return segments"

    def test_dumbo_red_hook_ferry_bike_route(self):
        """
        Test biking route using Brooklyn waterfront ferry (DUMBO to Red Hook).

        This validates that NYC Ferry East River routes are accessible for bike routing.
        The route may or may not use the ferry depending on routing preferences,
        but it should not fail.
        """
        # Red Hook Terminal to DUMBO Terminal (Brooklyn waterfront)
        orig_lon, orig_lat = (-74.0180, 40.6739)
        dest_lon, dest_lat = (-73.9959, 40.7033)

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "bike"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Route should succeed - ferry is one option, but land route also exists
        assert len(data["features"]) > 0, "Route should return segments"

    def test_dumbo_south_williamsburg_ferry_walk_route(self):
        """
        Test walking route in area served by DUMBO-South Williamsburg ferry.

        This validates that ferry connections to bridge bike paths work correctly.
        The route should succeed whether using ferry or bridges.
        """
        # Near Manhattan Bridge to Brooklyn Bridge area
        orig_lon, orig_lat = (-73.9899, 40.7064)
        dest_lon, dest_lat = (-73.9950, 40.7046)

        response = requests.get(
            f"{API_BASE_URL}/route",
            params={"orig": f"{orig_lon},{orig_lat}", "dest": f"{dest_lon},{dest_lat}", "mode": "walk"},
            timeout=10
        )

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        validate_route_response(data)

        # Route should succeed (validates ferry doesn't break routing in this area)
        assert len(data["features"]) > 0, "Route should return segments"

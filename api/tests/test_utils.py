import pytest

from api.utils.geo import dump_geo, parse_coordinates


class TestParseCoordinates:
    """Test suite for parse_coordinates function."""

    def test_parse_coordinates_valid(self):
        """Test parsing valid coordinates."""
        lon, lat = parse_coordinates("-73.9857,40.7484")
        assert lon == -73.9857
        assert lat == 40.7484

    def test_parse_coordinates_valid_with_spaces(self):
        """Test parsing coordinates with spaces (should fail)."""
        with pytest.raises(ValueError, match="Invalid coordinate format"):
            parse_coordinates("-73.9857, 40.7484")

    def test_parse_coordinates_manhattan(self):
        """Test valid Manhattan coordinates."""
        lon, lat = parse_coordinates("-73.9712,40.7831")
        assert lon == -73.9712
        assert lat == 40.7831

    def test_parse_coordinates_brooklyn(self):
        """Test valid Brooklyn coordinates."""
        lon, lat = parse_coordinates("-73.9442,40.6782")
        assert lon == -73.9442
        assert lat == 40.6782

    def test_parse_coordinates_queens(self):
        """Test valid Queens coordinates."""
        lon, lat = parse_coordinates("-73.7949,40.7282")
        assert lon == -73.7949
        assert lat == 40.7282

    def test_parse_coordinates_bronx(self):
        """Test valid Bronx coordinates."""
        lon, lat = parse_coordinates("-73.8648,40.8448")
        assert lon == -73.8648
        assert lat == 40.8448

    def test_parse_coordinates_staten_island(self):
        """Test valid Staten Island coordinates."""
        lon, lat = parse_coordinates("-74.1502,40.5795")
        assert lon == -74.1502
        assert lat == 40.5795

    def test_parse_coordinates_invalid_format_missing_comma(self):
        """Test parsing with missing comma."""
        with pytest.raises(ValueError, match="Invalid coordinate format"):
            parse_coordinates("-73.9857 40.7484")

    def test_parse_coordinates_invalid_format_too_many_parts(self):
        """Test parsing with too many parts."""
        with pytest.raises(ValueError, match="Invalid coordinate format"):
            parse_coordinates("-73.9857,40.7484,100")

    def test_parse_coordinates_invalid_format_non_numeric(self):
        """Test parsing with non-numeric values."""
        with pytest.raises(ValueError, match="Invalid coordinate format"):
            parse_coordinates("invalid,coords")

    def test_parse_coordinates_latitude_too_low(self):
        """Test latitude below NYC bounds."""
        with pytest.raises(ValueError, match="Latitude .* is outside NYC bounds"):
            parse_coordinates("-73.9857,40.0")

    def test_parse_coordinates_latitude_too_high(self):
        """Test latitude above NYC bounds."""
        with pytest.raises(ValueError, match="Latitude .* is outside NYC bounds"):
            parse_coordinates("-73.9857,41.5")

    def test_parse_coordinates_longitude_too_low(self):
        """Test longitude west of NYC bounds."""
        with pytest.raises(ValueError, match="Longitude .* is outside NYC bounds"):
            parse_coordinates("-75.0,40.7484")

    def test_parse_coordinates_longitude_too_high(self):
        """Test longitude east of NYC bounds."""
        with pytest.raises(ValueError, match="Longitude .* is outside NYC bounds"):
            parse_coordinates("-73.0,40.7484")

    def test_parse_coordinates_at_north_boundary(self):
        """Test coordinates at northern boundary."""
        lon, lat = parse_coordinates("-73.9,40.95")
        assert lon == -73.9
        assert lat == 40.95

    def test_parse_coordinates_at_south_boundary(self):
        """Test coordinates at southern boundary."""
        lon, lat = parse_coordinates("-74.0,40.4")
        assert lon == -74.0
        assert lat == 40.4

    def test_parse_coordinates_at_west_boundary(self):
        """Test coordinates at western boundary."""
        lon, lat = parse_coordinates("-74.3,40.7")
        assert lon == -74.3
        assert lat == 40.7

    def test_parse_coordinates_at_east_boundary(self):
        """Test coordinates at eastern boundary."""
        lon, lat = parse_coordinates("-73.7,40.7")
        assert lon == -73.7
        assert lat == 40.7

    def test_parse_coordinates_empty_string(self):
        """Test parsing empty string."""
        with pytest.raises(ValueError, match="Invalid coordinate format"):
            parse_coordinates("")


class TestDumpGeo:
    """Test suite for dump_geo function."""

    def test_dump_geo_none(self):
        """Test dump_geo with None input."""
        result = dump_geo(None)
        assert result is None

    def test_dump_geo_point(self):
        """Test dump_geo with Point WKB hex string."""
        # WKB hex for POINT(-73.9857 40.7484)
        wkb_hex = "0101000000713D0AD7A3705EC048E17A14AE474440"
        result = dump_geo(wkb_hex)

        assert result is not None
        assert result["type"] == "Point"
        assert len(result["coordinates"]) == 2
        # Check coordinates are close (allowing for floating point precision)
        assert abs(result["coordinates"][0] - (-73.9857)) < 0.0001
        assert abs(result["coordinates"][1] - 40.7484) < 0.0001

    def test_dump_geo_linestring(self):
        """Test dump_geo with LineString WKB hex string."""
        # WKB hex for LINESTRING(-73.9857 40.7484, -73.9855 40.7480)
        wkb_hex = (
            "010200000002000000713D0AD7A3705EC048E17A14AE4744409A9999999970" "5EC0713D0AD7A3474440"
        )
        result = dump_geo(wkb_hex)

        assert result is not None
        assert result["type"] == "LineString"
        assert len(result["coordinates"]) == 2
        assert len(result["coordinates"][0]) == 2
        assert len(result["coordinates"][1]) == 2
        # Check first coordinate
        assert abs(result["coordinates"][0][0] - (-73.9857)) < 0.0001
        assert abs(result["coordinates"][0][1] - 40.7484) < 0.0001

    def test_dump_geo_invalid_wkb(self):
        """Test dump_geo with invalid WKB hex string."""
        with pytest.raises(Exception):  # Shapely will raise an exception
            dump_geo("invalid_wkb_hex")

    def test_dump_geo_empty_string(self):
        """Test dump_geo with empty string."""
        with pytest.raises(Exception):  # Shapely will raise an exception
            dump_geo("")

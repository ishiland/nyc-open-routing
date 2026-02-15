from typing import Any, Dict, Optional

from shapely import geometry, wkb


def dump_geo(data: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    Convert a WKB hex string to a GeoJSON-like mapping.

    Args:
        data: WKB hex string representing geometry

    Returns:
        GeoJSON-compatible dictionary or None if data is None
    """
    if data is None:
        return None
    p = wkb.loads(data, hex=True)
    return geometry.mapping(p)


def parse_coordinates(coord_string: str) -> tuple[float, float]:
    """
    Parse a coordinate string in the format "longitude,latitude".

    Validates that coordinates are within NYC bounds:
    - Latitude: 40.4 to 40.95 (covers all 5 boroughs)
    - Longitude: -74.3 to -73.7 (covers all 5 boroughs)

    Args:
        coord_string: String in format "longitude,latitude"

    Returns:
        Tuple of (longitude, latitude) as floats

    Raises:
        ValueError: If the format is invalid or coordinates are out of bounds
    """
    try:
        lon, lat = map(float, coord_string.split(","))
    except ValueError:
        raise ValueError("Invalid coordinate format. Expected 'longitude,latitude'")

    # Validate NYC bounds
    # NYC approximate bounds: lat 40.4-40.95, lon -74.3 to -73.7
    if not (40.4 <= lat <= 40.95):
        raise ValueError(f"Latitude {lat} is outside NYC bounds (40.4 to 40.95)")
    if not (-74.3 <= lon <= -73.7):
        raise ValueError(f"Longitude {lon} is outside NYC bounds (-74.3 to -73.7)")

    return lon, lat

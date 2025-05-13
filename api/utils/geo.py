from shapely import wkb, geometry
from typing import Optional, Dict, Any

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
    
    Args:
        coord_string: String in format "longitude,latitude"
        
    Returns:
        Tuple of (longitude, latitude) as floats
        
    Raises:
        ValueError: If the format is invalid
    """
    try:
        lon, lat = map(float, coord_string.split(','))
        return lon, lat
    except ValueError:
        raise ValueError("Invalid coordinate format. Expected 'longitude,latitude'") 
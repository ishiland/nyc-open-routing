from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional, List
from enum import Enum

class TravelMode(str, Enum):
    """Travel mode options for routing."""
    DRIVE = "drive"
    BIKE = "bike"
    WALK = "walk"

class Properties(BaseModel):
    """Properties of a route segment feature."""
    seq: int
    street: Optional[str] = None
    distance: Optional[float] = None  # in feet
    travel_time: Optional[float] = None
    traffic_factor: Optional[float] = None  # traffic impact factor

    # Traffic factor explanation:
    # 1.0 = No traffic impact (free flow/default) or no data available
    # 1.2 = Light traffic (20% slowdown)
    # 1.5 = Medium traffic (50% slowdown)
    # 2.0 = Heavy traffic (doubles travel time)
    # 3.0 = Very heavy traffic (triples travel time)

class Feature(BaseModel):
    """GeoJSON feature representation."""
    properties: Properties
    geometry: Dict[str, Any]

class RouteResponse(BaseModel):
    """Response model for the route endpoint."""
    features: List[Feature]

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "features": [
                    {
                        "properties": {
                            "seq": 1,
                            "street": "MAIN ST",
                            "distance": 325.5,
                            "travel_time": 45.2,
                            "traffic_factor": 1.2
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [-73.98, 40.75],
                                [-73.97, 40.76]
                            ]
                        }
                    }
                ]
            }
        }
    ) 
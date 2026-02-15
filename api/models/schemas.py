from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional, List, Literal, Union
from enum import Enum

class TravelMode(str, Enum):
    """Travel mode options for routing."""
    DRIVE = "drive"
    BIKE = "bike"
    WALK = "walk"


class IsochroneView(str, Enum):
    """Isochrone visualization type."""
    POLYGON = "polygon"
    EDGES = "edges"


class IsochroneBandProperties(BaseModel):
    """Properties for a single isochrone band."""
    band_index: int
    minutes: float
    mode: str
    node_count: int


class IsochroneFeature(BaseModel):
    """GeoJSON feature for an isochrone band polygon."""
    type: Literal["Feature"] = "Feature"
    properties: IsochroneBandProperties
    geometry: Dict[str, Any]


class IsochroneEdgeProperties(BaseModel):
    """Properties for a single isochrone edge segment."""
    edge_id: int
    band_index: int
    agg_cost: float
    street: str


class IsochroneEdgeFeature(BaseModel):
    """GeoJSON feature for an isochrone edge LineString."""
    type: Literal["Feature"] = "Feature"
    properties: IsochroneEdgeProperties
    geometry: Dict[str, Any]


class IsochroneResponse(BaseModel):
    """Response model for the isochrone endpoint."""
    features: List[Union[IsochroneFeature, IsochroneEdgeFeature]]
    origin: Dict[str, Any]

class Properties(BaseModel):
    """Properties of a route segment feature."""
    seq: int
    street: Optional[str] = None
    distance: Optional[float] = None  # in feet
    travel_time: Optional[float] = None
    turn_instruction: Optional[str] = None  # Human-readable turn instruction
    turn_type: Optional[str] = None  # Machine-readable turn type for icons
    traffic_factor: Optional[float] = None  # traffic impact factor

    # Traffic factor explanation:
    # 1.0 = No traffic impact (free flow/default) or no data available
    # 1.2 = Light traffic (20% slowdown)
    # 1.5 = Medium traffic (50% slowdown)
    # 2.0 = Heavy traffic (doubles travel time)
    # 3.0 = Very heavy traffic (triples travel time)

    # Turn type values:
    # 'straight', 'slight-left', 'left', 'sharp-left',
    # 'slight-right', 'right', 'sharp-right', 'u-turn', 'continue'

class Feature(BaseModel):
    """GeoJSON feature representation."""
    type: Literal["Feature"] = "Feature"
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
                        "type": "Feature",
                        "properties": {
                            "seq": 1,
                            "street": "MAIN ST",
                            "distance": 325.5,
                            "travel_time": 45.2,
                            "turn_instruction": "Turn right onto MAIN ST",
                            "turn_type": "right",
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


class LegSummary(BaseModel):
    """Summary statistics for a single waypoint-to-waypoint leg."""
    distance: float
    travel_time: float


class LegResponse(BaseModel):
    """A single waypoint-to-waypoint route segment."""
    leg: int
    summary: LegSummary
    features: List[Feature]


class WaypointRouteSummary(BaseModel):
    """Overall summary for a multi-stop waypoint route."""
    total_distance: float
    total_travel_time: float
    num_legs: int


class WaypointRouteResponse(BaseModel):
    """Response model for the waypoint routing endpoint."""
    legs: List[LegResponse]
    summary: WaypointRouteSummary


class TrafficLayerFeature(BaseModel):
    """GeoJSON feature for a single traffic edge segment."""
    type: Literal["Feature"] = "Feature"
    properties: Dict[str, Any]
    geometry: Dict[str, Any]


class TrafficLayerResponse(BaseModel):
    """GeoJSON FeatureCollection of traffic-impacted edges."""
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[TrafficLayerFeature]
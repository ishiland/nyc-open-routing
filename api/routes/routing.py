from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List

from models.schemas import Feature, RouteResponse, TravelMode
from services.routing import RoutingService
from dependencies import get_routing_service

router = APIRouter(
    prefix="/api",
    tags=["routing"],
)

@router.get("/route", response_model=List[Feature])
def get_route(
    orig: str = Query(..., description="Origin address or identifier (longitude,latitude)"),
    dest: str = Query(..., description="Destination address or identifier (longitude,latitude)"),
    mode: TravelMode = Query(..., description="Routing mode: drive, bike, or walk"),
    use_traffic: bool = Query(default=True, description="Use traffic-aware routing for drive mode (requires traffic data)"),
    routing_service: RoutingService = Depends(get_routing_service)
):
    """
    Get a route between the origin and destination based on the specified mode.

    Supports drive, bike, and walk modes. For drive mode, traffic-aware routing can be
    toggled with the use_traffic parameter (defaults to True if traffic data is available).
    """
    if mode == TravelMode.DRIVE:
        return routing_service.get_driving_route(orig, dest, use_traffic=use_traffic)
    elif mode == TravelMode.BIKE:
        return routing_service.get_biking_route(orig, dest)
    elif mode == TravelMode.WALK:
        return routing_service.get_walking_route(orig, dest)
    else:
        raise HTTPException(status_code=400, detail="Invalid mode specified. Choose 'drive', 'bike', or 'walk'.") 
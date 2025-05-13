from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List

from models.schemas import Feature, RouteResponse
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
    mode: str = Query(..., description="Routing mode: drive, bike, or walk"),
    routing_service: RoutingService = Depends(get_routing_service)
):
    """
    Get a route between the origin and destination based on the specified mode.
    
    Currently only 'drive' mode is fully implemented.
    """
    mode = mode.lower()
    if mode == 'drive':
        return routing_service.get_driving_route(orig, dest)
    # elif mode == 'bike':
    #     return routing_service.get_biking_route(orig, dest)
    # elif mode == 'walk':
    #     return routing_service.get_walking_route(orig, dest)
    else:
        raise HTTPException(status_code=400, detail="Invalid mode specified. Choose 'drive', 'bike', or 'walk'.") 
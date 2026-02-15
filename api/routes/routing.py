from fastapi import APIRouter, Depends, HTTPException, Query

from dependencies import get_routing_service
from models.schemas import RouteResponse, TravelMode, WaypointRouteResponse
from services.routing import RoutingService
from utils.geo import parse_coordinates

router = APIRouter(
    prefix="/api",
    tags=["routing"],
)


@router.get("/route", response_model=RouteResponse)
def get_route(
    orig: str = Query(..., description="Origin address or identifier (longitude,latitude)"),
    dest: str = Query(..., description="Destination address or identifier (longitude,latitude)"),
    mode: TravelMode = Query(..., description="Routing mode: drive, bike, or walk"),
    use_traffic: bool = Query(
        default=True, description="Use traffic-aware routing for drive mode (requires traffic data)"
    ),
    avoid_ferries: bool = Query(
        default=False, description="Avoid ferry crossings for bike/walk modes"
    ),
    routing_service: RoutingService = Depends(get_routing_service),
):
    """
    Get a route between the origin and destination based on the specified mode.

    Supports drive, bike, and walk modes. For drive mode, traffic-aware routing can be
    toggled with the use_traffic parameter (defaults to True if traffic data is available).
    """
    if mode == TravelMode.DRIVE:
        return routing_service.get_driving_route(orig, dest, use_traffic=use_traffic)
    elif mode == TravelMode.BIKE:
        return routing_service.get_biking_route(orig, dest, avoid_ferries=avoid_ferries)
    elif mode == TravelMode.WALK:
        return routing_service.get_walking_route(orig, dest, avoid_ferries=avoid_ferries)
    else:
        raise HTTPException(
            status_code=400, detail="Invalid mode specified. Choose 'drive', 'bike', or 'walk'."
        )


@router.get("/route/waypoints", response_model=WaypointRouteResponse)
def get_waypoint_route(
    waypoints: str = Query(
        ...,
        description=(
            "Pipe-delimited waypoints in lon,lat format"
            " (2-3 points). Example:"
            " -73.98,40.75|-73.99,40.76|-74.00,40.77"
        ),
    ),
    mode: TravelMode = Query(..., description="Travel mode: drive, bike, or walk"),
    use_traffic: bool = Query(
        default=True, description="Use traffic-aware routing (drive mode only)"
    ),
    avoid_ferries: bool = Query(
        default=False, description="Avoid ferry crossings (bike/walk only)"
    ),
    routing_service: RoutingService = Depends(get_routing_service),
):
    """
    Get a multi-stop route through waypoints.

    Accepts 2-3 pipe-delimited waypoints in lon,lat format. Each consecutive pair
    of waypoints becomes a leg. Returns per-leg features and summaries plus an
    overall route summary.
    """
    # Parse waypoints
    pairs = waypoints.split("|")

    # Validate count
    if len(pairs) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints required")
    if len(pairs) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 waypoints supported")

    # Strip whitespace
    pairs = [p.strip() for p in pairs]

    # Validate each coordinate pair
    for pair in pairs:
        try:
            parse_coordinates(pair)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return routing_service.get_waypoint_route(
        waypoints=pairs,
        mode=mode.value,
        use_traffic=use_traffic,
        avoid_ferries=avoid_ferries,
    )

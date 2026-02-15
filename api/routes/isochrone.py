from typing import Optional

from fastapi import APIRouter, Depends, Query

from dependencies import get_isochrone_service
from models.schemas import IsochroneResponse, IsochroneView, TravelMode
from services.isochrone import IsochroneService

router = APIRouter(
    prefix="/api",
    tags=["isochrone"],
)


@router.get("/isochrone", response_model=IsochroneResponse)
def get_isochrone(
    orig: str = Query(..., description="Origin coordinates (longitude,latitude)"),
    mode: TravelMode = Query(
        default=TravelMode.DRIVE, description="Travel mode: drive, bike, or walk"
    ),
    intervals: Optional[str] = Query(
        default=None,
        description=(
            "Comma-separated time intervals in minutes" " (e.g., '5,10,15,20'). Default: 5,10,15,20"
        ),
    ),
    view: IsochroneView = Query(
        default=IsochroneView.POLYGON,
        description="Visualization type: polygon hulls or edge street segments",
    ),
    use_traffic: bool = Query(default=True, description="Use traffic-aware costs for drive mode"),
    hour: Optional[int] = Query(
        default=None, ge=0, le=23, description="Hour of day for traffic (0-23)"
    ),
    day_of_week: Optional[int] = Query(
        default=None, ge=1, le=7, description="Day of week for traffic (1=Mon, 7=Sun)"
    ),
    isochrone_service: IsochroneService = Depends(get_isochrone_service),
):
    """
    Get isochrone (reachability) data from an origin point.

    Returns concentric time-band data showing how far you can travel
    in the specified time intervals from the origin.

    Use view=polygon for hull polygons (default) or view=edges for per-street LineString segments.
    """
    # Parse intervals from comma-separated minutes list
    parsed_intervals = None
    if intervals:
        try:
            parsed_intervals = [float(v.strip()) for v in intervals.split(",")]
        except ValueError:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid intervals format."
                    " Use comma-separated numbers"
                    " (e.g., '5,10,15,20')."
                ),
            )

    if view == IsochroneView.EDGES:
        return isochrone_service.get_isochrone_edges(
            orig=orig,
            mode=mode.value,
            intervals=parsed_intervals,
            use_traffic=use_traffic,
            hour=hour,
            day_of_week=day_of_week,
        )

    return isochrone_service.get_isochrone(
        orig=orig,
        mode=mode.value,
        intervals=parsed_intervals,
        use_traffic=use_traffic,
        hour=hour,
        day_of_week=day_of_week,
    )

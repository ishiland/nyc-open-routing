import logging
from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_traffic_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/traffic",
    tags=["traffic"],
)


@router.get("/status")
def traffic_status(traffic_service=Depends(get_traffic_service)):
    """
    Get current traffic data status.

    Returns refresh state, timing, and edge coverage.
    When traffic is disabled, returns a minimal status object.
    """
    if traffic_service is None:
        return {
            "enabled": False,
            "data_loaded": False,
            "last_refresh": None,
            "last_success": None,
            "last_error": None,
            "edge_count": 0,
            "refresh_interval_seconds": None,
        }
    return traffic_service.status


@router.post("/refresh")
async def trigger_refresh(traffic_service=Depends(get_traffic_service)):
    """
    Trigger an immediate traffic data refresh.

    Returns 409 if a refresh is already in progress.
    Returns 503 if traffic is not enabled.
    """
    if traffic_service is None:
        raise HTTPException(
            status_code=503,
            detail="Traffic refresh is not enabled (TRAFFIC_ENABLED=false)",
        )

    success, error = await traffic_service.trigger_refresh()
    if not success:
        if "already in progress" in (error or ""):
            raise HTTPException(status_code=409, detail=error)
        raise HTTPException(status_code=500, detail=error)

    return {"status": "ok", "message": "Traffic data refreshed successfully"}

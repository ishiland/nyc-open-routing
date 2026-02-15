import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from dependencies import get_db_engine, get_traffic_service
from models.schemas import TrafficLayerFeature, TrafficLayerResponse
from utils.geo import dump_geo

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


_traffic_layer_sql = text("""
    SELECT
        e.id,
        e.street,
        e.traffic_factor,
        e.geom_4326 AS geom
    FROM edges e
    WHERE e.traffic_factor > 1.0
      AND e.driveable = TRUE
      AND e.geom_4326 && ST_MakeEnvelope(:west, :south, :east, :north, 4326)
""")


@router.get("/layer", response_model=TrafficLayerResponse)
def traffic_layer(
    bbox: str = Query(..., description="Bounding box: west,south,east,north"),
):
    """
    Get traffic layer GeoJSON for the given bounding box.

    Returns a FeatureCollection of driveable edges with traffic_factor > 1.0
    within the viewport. Empty viewports return an empty features array.
    """
    try:
        parts = [float(x.strip()) for x in bbox.split(",")]
        if len(parts) != 4:
            raise ValueError()
        west, south, east, north = parts
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid bbox format. Expected: west,south,east,north",
        )

    if not (-180 <= west <= 180 and -180 <= east <= 180):
        raise HTTPException(status_code=400, detail="Longitude values must be between -180 and 180")
    if not (-90 <= south <= 90 and -90 <= north <= 90):
        raise HTTPException(status_code=400, detail="Latitude values must be between -90 and 90")
    if west >= east or south >= north:
        raise HTTPException(
            status_code=400,
            detail="Invalid bbox: west must be < east, south must be < north",
        )

    engine = get_db_engine()
    with engine.connect() as conn:
        result = conn.execute(
            _traffic_layer_sql,
            {"west": west, "south": south, "east": east, "north": north},
        )
        rows = result.fetchall()

    features = []
    for row in rows:
        row_dict = dict(row._mapping)
        features.append(
            TrafficLayerFeature(
                properties={
                    "id": row_dict["id"],
                    "street": row_dict["street"] or "",
                    "traffic_factor": float(row_dict["traffic_factor"]),
                },
                geometry=dump_geo(row_dict["geom"]),
            )
        )

    return TrafficLayerResponse(features=features)

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from starlette.responses import Response

from dependencies import get_db_engine, get_traffic_service
from utils.cache import get_tile_cache

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


_tile_sql = text("""
    WITH bounds AS (
        SELECT ST_TileEnvelope(:z, :x, :y) AS geom
    ),
    mvtgeom AS (
        SELECT
            ST_AsMVTGeom(ST_Transform(e.geom_4326, 3857), bounds.geom) AS geom,
            e.id,
            e.street,
            e.traffic_factor::double precision AS traffic_factor
        FROM edges e, bounds
        WHERE e.traffic_factor > 1.0
          AND e.driveable = TRUE
          AND e.geom_4326 && ST_Transform(bounds.geom, 4326)
    )
    SELECT ST_AsMVT(mvtgeom.*, 'traffic') AS mvt
    FROM mvtgeom
    WHERE geom IS NOT NULL
""")


@router.get("/tiles/{z}/{x}/{y}.pbf")
def traffic_tile(z: int, x: int, y: int):
    """
    Get a vector tile (MVT) of traffic-impacted edges.

    Returns a protobuf-encoded tile with a 'traffic' layer containing
    driveable edges where traffic_factor > 1.0.
    """
    if z < 0 or z > 22:
        raise HTTPException(400, "z must be 0-22")

    tile_cache = get_tile_cache()
    cached = tile_cache.get(z, x, y)
    if cached is not None:
        return Response(
            content=cached,
            media_type="application/x-protobuf",
            headers={"Cache-Control": "public, max-age=300"},
        )

    engine = get_db_engine()
    with engine.connect() as conn:
        result = conn.execute(_tile_sql, {"z": z, "x": x, "y": y})
        row = result.fetchone()

    mvt_bytes = bytes(row[0]) if row and row[0] else b""
    tile_cache.set(z, x, y, mvt_bytes)

    return Response(
        content=mvt_bytes,
        media_type="application/x-protobuf",
        headers={"Cache-Control": "public, max-age=300"},
    )

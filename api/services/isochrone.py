import logging
from typing import List

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Engine

from models.schemas import (
    IsochroneBandProperties,
    IsochroneEdgeFeature,
    IsochroneEdgeProperties,
    IsochroneFeature,
    IsochroneResponse,
)
from utils.cache import get_route_cache
from utils.geo import dump_geo, parse_coordinates

logger = logging.getLogger(__name__)

# Default intervals: 5, 10, 15, 20 minutes (cost units are in minutes)
DEFAULT_INTERVALS = [5, 10, 15, 20]


class IsochroneService:
    def __init__(self, db_engine: Engine):
        self.engine = db_engine
        self.cache = get_route_cache()

    def get_isochrone(
        self,
        orig: str,
        mode: str,
        intervals: List[float] = None,
        use_traffic: bool = True,
    ) -> IsochroneResponse:
        if intervals is None:
            intervals = DEFAULT_INTERVALS

        # Cache key
        intervals_str = ",".join(str(i) for i in intervals)
        if mode == "drive" and use_traffic:
            cache_suffix = "iso-traffic"
        else:
            cache_suffix = f"iso-{mode}"
        cached = self.cache.get(orig, intervals_str, cache_suffix)
        if cached is not None:
            logger.info(f"Cache hit for isochrone from {orig} ({cache_suffix})")
            return cached

        # Parse coordinates
        try:
            orig_lon, orig_lat = parse_coordinates(orig)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Execute the appropriate SQL function
        try:
            if mode == "drive":
                sql = text(
                    "SELECT * FROM getdrivingisochrone(:lon, :lat, :intervals, :use_traffic)"
                )
                params = {
                    "lon": orig_lon,
                    "lat": orig_lat,
                    "intervals": intervals,
                    "use_traffic": use_traffic,
                }
            elif mode == "bike":
                sql = text("SELECT * FROM getbikingisochrone(:lon, :lat, :intervals)")
                params = {"lon": orig_lon, "lat": orig_lat, "intervals": intervals}
            elif mode == "walk":
                sql = text("SELECT * FROM getwalkingisochrone(:lon, :lat, :intervals)")
                params = {"lon": orig_lon, "lat": orig_lat, "intervals": intervals}
            else:
                raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")

            with self.engine.connect() as conn:
                result = conn.execute(sql, params)
                rows = result.fetchall()

            logger.info(f"Isochrone returned {len(rows)} bands for mode={mode}")

            if len(rows) == 0:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No reachable area found from this location."
                        " Try a different origin or travel mode."
                    ),
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error executing isochrone query: {e}")
            if (
                mode == "drive"
                and use_traffic
                and ("traffic_factor" in str(e) or "avg_traffic_by_segment" in str(e))
            ):
                logger.warning(
                    "Traffic data not available for isochrone, falling back to non-traffic"
                )
                return self.get_isochrone(orig, mode, intervals, use_traffic=False)
            raise HTTPException(status_code=500, detail="Error processing isochrone request.")

        # Convert to response
        features = []
        for row in rows:
            row_dict = (
                dict(row._mapping) if hasattr(row, "_mapping") else dict(zip(result.keys(), row))
            )
            feature = IsochroneFeature(
                properties=IsochroneBandProperties(
                    band_index=row_dict["band_index"],
                    minutes=row_dict["minutes"],
                    mode=mode,
                    node_count=row_dict["node_count"],
                ),
                geometry=dump_geo(row_dict["geom"]),
            )
            features.append(feature)

        origin_geojson = {
            "type": "Point",
            "coordinates": [orig_lon, orig_lat],
        }

        response = IsochroneResponse(features=features, origin=origin_geojson)

        # Cache result
        self.cache.set(orig, intervals_str, cache_suffix, response)

        return response

    def get_isochrone_edges(
        self,
        orig: str,
        mode: str,
        intervals: List[float] = None,
        use_traffic: bool = True,
    ) -> IsochroneResponse:
        """Get edge-based isochrone returning LineString features per street segment."""
        if intervals is None:
            intervals = DEFAULT_INTERVALS

        # Cache key (separate prefix to avoid collisions with polygon cache)
        intervals_str = ",".join(str(i) for i in intervals)
        if mode == "drive" and use_traffic:
            cache_suffix = "iso-edges-traffic"
        else:
            cache_suffix = f"iso-edges-{mode}"
        cached = self.cache.get(orig, intervals_str, cache_suffix)
        if cached is not None:
            logger.info(f"Cache hit for edge isochrone from {orig} ({cache_suffix})")
            return cached

        # Parse coordinates
        try:
            orig_lon, orig_lat = parse_coordinates(orig)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Execute the appropriate edge SQL function
        try:
            if mode == "drive":
                sql = text(
                    "SELECT * FROM getdrivingisochrone_edges(:lon, :lat, :intervals, :use_traffic)"
                )
                params = {
                    "lon": orig_lon,
                    "lat": orig_lat,
                    "intervals": intervals,
                    "use_traffic": use_traffic,
                }
            elif mode == "bike":
                sql = text("SELECT * FROM getbikingisochrone_edges(:lon, :lat, :intervals)")
                params = {"lon": orig_lon, "lat": orig_lat, "intervals": intervals}
            elif mode == "walk":
                sql = text("SELECT * FROM getwalkingisochrone_edges(:lon, :lat, :intervals)")
                params = {"lon": orig_lon, "lat": orig_lat, "intervals": intervals}
            else:
                raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")

            with self.engine.connect() as conn:
                result = conn.execute(sql, params)
                rows = result.fetchall()

            logger.info(f"Edge isochrone returned {len(rows)} edges for mode={mode}")

            if len(rows) == 0:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No reachable edges found from this location."
                        " Try a different origin or travel mode."
                    ),
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error executing edge isochrone query: {e}")
            if (
                mode == "drive"
                and use_traffic
                and ("traffic_factor" in str(e) or "avg_traffic_by_segment" in str(e))
            ):
                logger.warning(
                    "Traffic data not available for edge isochrone, falling back to non-traffic"
                )
                return self.get_isochrone_edges(orig, mode, intervals, use_traffic=False)
            raise HTTPException(status_code=500, detail="Error processing edge isochrone request.")

        # Convert to response
        features = []
        for row in rows:
            row_dict = (
                dict(row._mapping) if hasattr(row, "_mapping") else dict(zip(result.keys(), row))
            )
            feature = IsochroneEdgeFeature(
                properties=IsochroneEdgeProperties(
                    edge_id=row_dict["edge_id"],
                    band_index=row_dict["band_index"],
                    agg_cost=row_dict["agg_cost"],
                    street=row_dict["street"],
                ),
                geometry=dump_geo(row_dict["geom"]),
            )
            features.append(feature)

        origin_geojson = {
            "type": "Point",
            "coordinates": [orig_lon, orig_lat],
        }

        response = IsochroneResponse(features=features, origin=origin_geojson)

        # Cache result
        self.cache.set(orig, intervals_str, cache_suffix, response)

        return response

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.engine import Engine
from sqlalchemy import text
from geosupport import Geosupport
from geosupport.error import GeosupportError
import logging

from dependencies import get_db_engine, get_geosupport, get_traffic_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1",
    tags=["health"],
)


@router.get("/health")
def health_check():
    """
    Liveness probe - returns 200 if the application is running.

    This endpoint is used by container orchestrators (Docker, K8s) to
    determine if the application process is alive and should accept traffic.
    """
    return {"status": "healthy"}


@router.get("/ready")
def readiness_check(
    db_engine: Engine = Depends(get_db_engine),
    geosupport: Geosupport = Depends(get_geosupport),
    traffic_service=Depends(get_traffic_service),
):
    """
    Readiness probe - returns 200 if the application can serve traffic.

    Checks:
    - Database connection is available
    - Can execute a simple query
    - Geosupport library is properly initialized

    This endpoint is used by load balancers and orchestrators to determine
    if the instance should receive traffic.
    """
    status = {
        "status": "ready",
        "database": "unknown",
        "geosupport": "unknown",
        "traffic_data_loaded": (
            traffic_service.data_loaded if traffic_service else None
        ),
    }
    errors = []

    # Check database connection
    try:
        with db_engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        status["database"] = "connected"
    except Exception as e:
        logger.error(f"Database check failed: {e}")
        status["database"] = "disconnected"
        errors.append(f"Database: {str(e)}")

    # Check Geosupport with a known valid NYC address
    try:
        # Test with City Hall address - known valid address
        test_result = geosupport["1A"](
            street_name="Broadway",
            house_number="260",
            borough="Manhattan",
        )
        if test_result and "House Number - Display Format" in test_result:
            status["geosupport"] = "operational"
        else:
            status["geosupport"] = "unexpected_response"
            errors.append("Geosupport: Unexpected response format")
    except GeosupportError as e:
        logger.error(f"Geosupport check failed: {e}")
        status["geosupport"] = "error"
        errors.append(f"Geosupport: {str(e)}")
    except Exception as e:
        logger.error(f"Geosupport check failed unexpectedly: {e}")
        status["geosupport"] = "error"
        errors.append(f"Geosupport: {str(e)}")

    # If any checks failed, return 503
    if errors:
        status["status"] = "not ready"
        status["errors"] = errors
        raise HTTPException(status_code=503, detail=status)

    return status

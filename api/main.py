import asyncio
import logging
import logging.config
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config.settings import settings
from dependencies import get_traffic_service
from routes import routing, search, health, isochrone, traffic
from middleware.logging import RequestLoggingMiddleware
from exceptions import (
    RoutingError,
    InvalidCoordinatesError,
    RouteNotFoundError,
    DatabaseError,
)
from fastapi.responses import JSONResponse

# Configure logging
logging.config.dictConfig(settings.LOGGING_CONFIG)
logger = logging.getLogger(__name__)

# Configure rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


# Exception handlers
async def routing_error_handler(request: Request, exc: RoutingError):
    """Handle domain-specific routing errors."""
    status_map = {
        InvalidCoordinatesError: 400,
        RouteNotFoundError: 404,
        DatabaseError: 500,
    }
    status_code = status_map.get(type(exc), 500)

    return JSONResponse(
        status_code=status_code,
        content={
            "error": exc.message,
            "details": exc.details,
            "correlation_id": getattr(
                request.state, "correlation_id", None
            ),
        },
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle — start/stop background traffic refresh."""
    task = None
    traffic_service = get_traffic_service()

    if traffic_service is not None:
        logger.info(
            "Traffic refresh enabled: "
            f"interval={settings.TRAFFIC_REFRESH_INTERVAL}s"
        )
        task = asyncio.create_task(traffic_service.run_refresh_loop())
    else:
        logger.info("Traffic refresh disabled (TRAFFIC_ENABLED=false)")

    yield

    # Shutdown: cancel background task
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        logger.info("Traffic refresh background task stopped")


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.API_TITLE,
        description=settings.API_DESCRIPTION,
        version=settings.API_VERSION,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Add rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Add domain exception handlers
    app.add_exception_handler(RoutingError, routing_error_handler)

    # Add request logging middleware (before CORS)
    app.add_middleware(RequestLoggingMiddleware)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=settings.ALLOW_METHODS,
        allow_headers=settings.ALLOW_HEADERS,
    )

    # Include routers
    app.include_router(health.router)
    app.include_router(routing.router)
    app.include_router(isochrone.router)
    app.include_router(search.router)
    app.include_router(traffic.router)

    logger.info(
        f"Application {settings.API_TITLE} v{settings.API_VERSION} initialized"
    )
    return app


app = create_application()

"""
Simple in-memory cache for routing results.

This provides basic LRU caching to avoid redundant database queries
for frequently requested routes.
"""

import hashlib
import logging
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)


class RouteCache:
    """
    Simple in-memory route caching with TTL (time-to-live).

    IMPORTANT: This cache is stored in-memory and NOT shared across workers.
    - For local development: Use single worker mode (uvicorn without --workers flag)
    - For production: Replace with Redis/Memcached for shared cache across workers

    Current behavior with multiple workers:
    - Each worker maintains its own cache instance
    - Cache hit rate decreases proportionally (e.g., 75% drop with 4 workers)
    - Routes are still correct, just less efficient

    Uses Python's built-in dictionary for simplicity and performance.
    """

    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000):
        """
        Initialize route cache.

        Args:
            ttl_seconds: Time-to-live for cached routes in seconds (default: 5 minutes)
            max_size: Maximum number of routes to cache (default: 1000)
        """
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self._cache = {}
        self._timestamps = {}

    def _normalize_coord(self, coord: str) -> str:
        """
        Normalize coordinate string to 6 decimal places (~0.1m precision).

        This increases cache hit rate for coordinates that are slightly different
        but represent the same location (e.g., from different geocoders).

        Args:
            coord: Coordinate string in "lon,lat" format

        Returns:
            Normalized coordinate string
        """
        try:
            lon, lat = coord.split(",")
            lon_norm = f"{float(lon):.6f}"
            lat_norm = f"{float(lat):.6f}"
            return f"{lon_norm},{lat_norm}"
        except (ValueError, AttributeError):
            # If normalization fails, return original
            return coord

    def _make_key(self, orig: str, dest: str, mode: str, **kwargs) -> str:
        """
        Create a cache key from route parameters.

        Args:
            orig: Origin coordinates
            dest: Destination coordinates
            mode: Travel mode
            **kwargs: Additional parameters (e.g., traffic params)

        Returns:
            Cache key string
        """
        # Normalize coordinates for better cache hit rate
        orig_norm = self._normalize_coord(orig)
        dest_norm = self._normalize_coord(dest)

        # Sort kwargs for consistent keys
        sorted_kwargs = sorted(kwargs.items())
        key_data = f"{orig_norm}|{dest_norm}|{mode}|{sorted_kwargs}"
        # Use hash for shorter keys
        return hashlib.md5(key_data.encode()).hexdigest()

    def get(self, orig: str, dest: str, mode: str, **kwargs) -> Optional[Any]:
        """
        Get cached route if available and not expired.

        Args:
            orig: Origin coordinates
            dest: Destination coordinates
            mode: Travel mode
            **kwargs: Additional parameters

        Returns:
            Cached route data or None if not found/expired
        """
        try:
            key = self._make_key(orig, dest, mode, **kwargs)

            # Check if key exists
            if key not in self._cache:
                return None

            # Check if expired
            timestamp = self._timestamps.get(key, 0)
            if time.time() - timestamp > self.ttl_seconds:
                # Expired, remove from cache
                self._cache.pop(key, None)
                self._timestamps.pop(key, None)
                return None

            return self._cache[key]
        except Exception as e:
            # Log error but don't fail - graceful degradation
            logger.warning(f"Cache get failed: {e}")
            return None

    def set(self, orig: str, dest: str, mode: str, data: Any, **kwargs) -> None:
        """
        Cache route data.

        Args:
            orig: Origin coordinates
            dest: Destination coordinates
            mode: Travel mode
            data: Route data to cache
            **kwargs: Additional parameters
        """
        try:
            key = self._make_key(orig, dest, mode, **kwargs)

            # Implement simple LRU: if cache is full, remove oldest entry
            if len(self._cache) >= self.max_size and key not in self._cache:
                # Find and remove oldest entry
                oldest_key = min(self._timestamps.items(), key=lambda x: x[1])[0]
                self._cache.pop(oldest_key, None)
                self._timestamps.pop(oldest_key, None)

            self._cache[key] = data
            self._timestamps[key] = time.time()
        except Exception as e:
            # Log error but don't fail - graceful degradation
            logger.warning(f"Cache set failed: {e}")

    def clear(self) -> None:
        """Clear all cached routes."""
        self._cache.clear()
        self._timestamps.clear()

    def size(self) -> int:
        """Get current cache size."""
        return len(self._cache)


# Global cache instance (singleton pattern for simplicity)
# In production with multiple workers, use Redis or similar
_route_cache = RouteCache(ttl_seconds=300, max_size=1000)


def get_route_cache() -> RouteCache:
    """Get the global route cache instance."""
    return _route_cache


class TileCache:
    """In-memory tile cache with TTL. Keyed by (z, x, y) tuple."""

    def __init__(self, ttl_seconds: int = 300, max_size: int = 4096):
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        self._cache: dict[tuple, bytes] = {}
        self._timestamps: dict[tuple, float] = {}

    def get(self, z: int, x: int, y: int) -> bytes | None:
        key = (z, x, y)
        if key not in self._cache:
            return None
        if time.time() - self._timestamps.get(key, 0) > self.ttl_seconds:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)
            return None
        return self._cache[key]

    def set(self, z: int, x: int, y: int, data: bytes) -> None:
        key = (z, x, y)
        if len(self._cache) >= self.max_size and key not in self._cache:
            oldest_key = min(self._timestamps.items(), key=lambda x: x[1])[0]
            self._cache.pop(oldest_key, None)
            self._timestamps.pop(oldest_key, None)
        self._cache[key] = data
        self._timestamps[key] = time.time()

    def clear(self) -> None:
        self._cache.clear()
        self._timestamps.clear()


_tile_cache = TileCache(ttl_seconds=300, max_size=4096)


def get_tile_cache() -> TileCache:
    """Get the global tile cache instance."""
    return _tile_cache

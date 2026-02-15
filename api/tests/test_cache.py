import time

import pytest

from api.utils.cache import RouteCache, get_route_cache


class TestRouteCache:
    """Test suite for RouteCache class."""

    def test_cache_init_defaults(self):
        """Test cache initialization with default values."""
        cache = RouteCache()
        assert cache.ttl_seconds == 300
        assert cache.max_size == 1000
        assert cache.size() == 0

    def test_cache_init_custom_values(self):
        """Test cache initialization with custom values."""
        cache = RouteCache(ttl_seconds=600, max_size=500)
        assert cache.ttl_seconds == 600
        assert cache.max_size == 500
        assert cache.size() == 0

    def test_cache_set_and_get(self):
        """Test basic cache set and get operations."""
        cache = RouteCache()
        test_data = [{"seq": 1, "street": "Broadway"}]

        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", test_data)
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive")

        assert result == test_data
        assert cache.size() == 1

    def test_cache_miss(self):
        """Test cache miss returns None."""
        cache = RouteCache()
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive")
        assert result is None

    def test_cache_different_modes(self):
        """Test that different travel modes are cached separately."""
        cache = RouteCache()
        drive_data = [{"mode": "drive"}]
        bike_data = [{"mode": "bike"}]
        walk_data = [{"mode": "walk"}]

        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", drive_data)
        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "bike", bike_data)
        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "walk", walk_data)

        assert cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive") == drive_data
        assert cache.get("-73.9857,40.7484", "-73.9950,40.7352", "bike") == bike_data
        assert cache.get("-73.9857,40.7484", "-73.9950,40.7352", "walk") == walk_data
        assert cache.size() == 3

    def test_cache_coordinate_normalization(self):
        """Test that coordinates are normalized for better hit rate."""
        cache = RouteCache()
        test_data = [{"seq": 1}]

        # Set with more decimal places
        cache.set("-73.98570000,40.74840000", "-73.9950,40.7352", "drive", test_data)

        # Get with fewer decimal places (should still hit)
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive")
        assert result == test_data

    def test_cache_coordinate_normalization_precision(self):
        """Test coordinate normalization to 6 decimal places."""
        cache = RouteCache()

        # Normalize should round to 6 decimal places
        normalized = cache._normalize_coord("-73.98571234,40.74841234")
        assert normalized == "-73.985712,40.748412"

    def test_cache_ttl_expiration(self):
        """Test that cache entries expire after TTL."""
        cache = RouteCache(ttl_seconds=1)  # 1 second TTL
        test_data = [{"seq": 1}]

        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", test_data)

        # Should be available immediately
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive")
        assert result == test_data

        # Wait for expiration
        time.sleep(1.1)

        # Should be expired now
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive")
        assert result is None
        assert cache.size() == 0  # Expired entries are removed

    def test_cache_lru_eviction(self):
        """Test that oldest entries are evicted when cache is full."""
        cache = RouteCache(max_size=3)

        # Fill cache to max
        cache.set("-73.985,40.748", "-73.995,40.735", "drive", "data1")
        cache.set("-73.986,40.749", "-73.996,40.736", "drive", "data2")
        cache.set("-73.987,40.750", "-73.997,40.737", "drive", "data3")
        assert cache.size() == 3

        # Add one more - should evict oldest
        time.sleep(0.01)  # Ensure different timestamps
        cache.set("-73.988,40.751", "-73.998,40.738", "drive", "data4")

        assert cache.size() == 3
        # First entry should be evicted
        assert cache.get("-73.985,40.748", "-73.995,40.735", "drive") is None
        # New entry should be present
        assert cache.get("-73.988,40.751", "-73.998,40.738", "drive") == "data4"

    def test_cache_update_existing_key(self):
        """Test that updating existing key doesn't increase size."""
        cache = RouteCache()
        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", "data1")
        assert cache.size() == 1

        # Update with new data
        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", "data2")
        assert cache.size() == 1
        assert cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive") == "data2"

    def test_cache_clear(self):
        """Test clearing all cache entries."""
        cache = RouteCache()
        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", "data1")
        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "bike", "data2")
        assert cache.size() == 2

        cache.clear()
        assert cache.size() == 0
        assert cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive") is None

    def test_cache_with_kwargs(self):
        """Test cache with additional keyword arguments."""
        cache = RouteCache()
        test_data = [{"seq": 1}]

        # Set with traffic parameter
        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", test_data, traffic=True)

        # Get without traffic param should miss
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive")
        assert result is None

        # Get with traffic param should hit
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive", traffic=True)
        assert result == test_data

    def test_cache_kwargs_order_independence(self):
        """Test that kwarg order doesn't affect cache key."""
        cache = RouteCache()
        test_data = [{"seq": 1}]

        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", test_data, hour=12, day=1)

        # Different kwarg order should still hit
        result = cache.get("-73.9857,40.7484", "-73.9950,40.7352", "drive", day=1, hour=12)
        assert result == test_data

    def test_cache_normalize_invalid_coordinates(self):
        """Test normalization with invalid coordinate format."""
        cache = RouteCache()

        # Should return original string if normalization fails
        result = cache._normalize_coord("invalid")
        assert result == "invalid"

    def test_cache_graceful_error_handling_get(self):
        """Test that cache errors during get don't crash."""
        cache = RouteCache()

        # Try to get with problematic inputs - should return None gracefully
        result = cache.get(None, None, None)
        assert result is None

    def test_cache_graceful_error_handling_set(self):
        """Test that cache errors during set don't crash."""
        cache = RouteCache()

        # Try to set with problematic inputs - should not raise exception
        try:
            cache.set(None, None, None, "data")
        except Exception:
            pytest.fail("Cache.set should not raise exceptions")

    def test_cache_size_method(self):
        """Test size method returns correct count."""
        cache = RouteCache()
        assert cache.size() == 0

        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "drive", "data1")
        assert cache.size() == 1

        cache.set("-73.9857,40.7484", "-73.9950,40.7352", "bike", "data2")
        assert cache.size() == 2


class TestTileCache:
    """Test suite for TileCache class."""

    def test_tile_cache_init_defaults(self):
        """Test tile cache initialization with default values."""
        from api.utils.cache import TileCache

        cache = TileCache()
        assert cache.ttl_seconds == 300
        assert cache.max_size == 4096

    def test_tile_cache_init_custom(self):
        """Test tile cache initialization with custom values."""
        from api.utils.cache import TileCache

        cache = TileCache(ttl_seconds=60, max_size=100)
        assert cache.ttl_seconds == 60
        assert cache.max_size == 100

    def test_tile_cache_set_and_get(self):
        """Test basic set and get operations."""
        from api.utils.cache import TileCache

        cache = TileCache()
        tile_data = b"\x1a\x00\x01\x02"

        cache.set(14, 4825, 6157, tile_data)
        result = cache.get(14, 4825, 6157)

        assert result == tile_data

    def test_tile_cache_miss(self):
        """Test cache miss returns None."""
        from api.utils.cache import TileCache

        cache = TileCache()
        assert cache.get(14, 4825, 6157) is None

    def test_tile_cache_different_tiles(self):
        """Test that different z/x/y coords are cached separately."""
        from api.utils.cache import TileCache

        cache = TileCache()

        cache.set(14, 4825, 6157, b"tile1")
        cache.set(14, 4826, 6157, b"tile2")
        cache.set(15, 4825, 6157, b"tile3")

        assert cache.get(14, 4825, 6157) == b"tile1"
        assert cache.get(14, 4826, 6157) == b"tile2"
        assert cache.get(15, 4825, 6157) == b"tile3"

    def test_tile_cache_ttl_expiration(self):
        """Test that entries expire after TTL."""
        from api.utils.cache import TileCache

        cache = TileCache(ttl_seconds=1)

        cache.set(14, 4825, 6157, b"tile_data")
        assert cache.get(14, 4825, 6157) == b"tile_data"

        time.sleep(1.1)
        assert cache.get(14, 4825, 6157) is None

    def test_tile_cache_lru_eviction(self):
        """Test that oldest entries are evicted when cache is full."""
        from api.utils.cache import TileCache

        cache = TileCache(max_size=3)

        cache.set(14, 1, 1, b"tile1")
        time.sleep(0.01)
        cache.set(14, 2, 2, b"tile2")
        time.sleep(0.01)
        cache.set(14, 3, 3, b"tile3")

        # Adding a 4th should evict the oldest (14, 1, 1)
        cache.set(14, 4, 4, b"tile4")

        assert cache.get(14, 1, 1) is None
        assert cache.get(14, 2, 2) == b"tile2"
        assert cache.get(14, 4, 4) == b"tile4"

    def test_tile_cache_update_existing(self):
        """Test updating existing key doesn't increase cache size."""
        from api.utils.cache import TileCache

        cache = TileCache()

        cache.set(14, 4825, 6157, b"old")
        cache.set(14, 4825, 6157, b"new")

        assert cache.get(14, 4825, 6157) == b"new"
        assert len(cache._cache) == 1

    def test_tile_cache_clear(self):
        """Test clearing all entries."""
        from api.utils.cache import TileCache

        cache = TileCache()

        cache.set(14, 1, 1, b"t1")
        cache.set(14, 2, 2, b"t2")
        cache.clear()

        assert cache.get(14, 1, 1) is None
        assert cache.get(14, 2, 2) is None
        assert len(cache._cache) == 0

    def test_tile_cache_empty_bytes(self):
        """Test caching empty byte strings (empty tiles)."""
        from api.utils.cache import TileCache

        cache = TileCache()

        cache.set(14, 0, 0, b"")
        result = cache.get(14, 0, 0)
        assert result == b""


class TestGlobalCacheInstance:
    """Test suite for global cache instance."""

    def test_get_route_cache_returns_instance(self):
        """Test that get_route_cache returns a RouteCache instance."""
        cache = get_route_cache()
        assert isinstance(cache, RouteCache)

    def test_get_route_cache_singleton(self):
        """Test that get_route_cache returns the same instance."""
        cache1 = get_route_cache()
        cache2 = get_route_cache()
        assert cache1 is cache2

    def test_global_cache_default_config(self):
        """Test that global cache has expected default configuration."""
        cache = get_route_cache()
        assert cache.ttl_seconds == 300
        assert cache.max_size == 1000

    def test_get_tile_cache_returns_instance(self):
        """Test that get_tile_cache returns a TileCache instance."""
        from api.utils.cache import TileCache, get_tile_cache

        cache = get_tile_cache()
        assert isinstance(cache, TileCache)

    def test_get_tile_cache_singleton(self):
        """Test that get_tile_cache returns the same instance."""
        from api.utils.cache import get_tile_cache

        cache1 = get_tile_cache()
        cache2 = get_tile_cache()
        assert cache1 is cache2

    def test_tile_cache_default_config(self):
        """Test that global tile cache has expected defaults."""
        from api.utils.cache import get_tile_cache

        cache = get_tile_cache()
        assert cache.ttl_seconds == 300
        assert cache.max_size == 4096

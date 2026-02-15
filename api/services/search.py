import logging
import time
from typing import Any, Dict, List

import anyio
from fastapi import HTTPException
from geosupport.error import GeosupportError
from suggest import GeosupportSuggest

from config.settings import settings
from utils.retry import retry_with_backoff

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self, geosupport_suggest: GeosupportSuggest):
        """
        Initialize the search service using NYC Geosupport library.

        Args:
            geosupport_suggest: GeosupportSuggest instance for address autocomplete
        """
        self.suggest = geosupport_suggest
        self.timeout = settings.GEOSUPPORT_TIMEOUT

    async def search_address(self, address: str) -> Dict[str, Any]:
        """
        Search for address suggestions using NYC Geosupport library.

        Args:
            address: The address query to search

        Returns:
            GeoJSON FeatureCollection with address suggestions

        Raises:
            HTTPException: If error occurs during search
        """
        start_time = time.time()
        logger.info(f"Searching for address: {address}")

        try:
            # Call Geosupport with retry logic in thread pool (blocking operation)
            # This prevents blocking the async event loop
            suggestions = await anyio.to_thread.run_sync(self._search_with_retry, address)

            # Convert to GeoJSON format
            result = self.suggest.to_geojson(suggestions)

            # Add 'label' field for frontend compatibility (alias for 'address')
            # Frontend Search component expects 'label' property
            for feature in result.get("features", []):
                if "properties" in feature and "address" in feature["properties"]:
                    feature["properties"]["label"] = feature["properties"]["address"]

            elapsed_time = time.time() - start_time
            logger.info(
                f"Address search completed in {elapsed_time:.3f}s. "
                f"Found {len(result.get('features', []))} suggestions"
            )

            return result

        except GeosupportError as e:
            elapsed_time = time.time() - start_time
            logger.error(f"Geosupport error after {elapsed_time:.3f}s: {e}")

            # Map Geosupport errors to user-friendly messages
            error_message = self._get_user_friendly_error(e)
            raise HTTPException(status_code=400, detail=error_message)

        except TimeoutError as e:
            elapsed_time = time.time() - start_time
            logger.error(f"Geosupport timeout after {elapsed_time:.3f}s: {e}")
            raise HTTPException(
                status_code=504, detail="Address search timed out. Please try again."
            )

        except Exception as e:
            elapsed_time = time.time() - start_time
            logger.error(f"Unexpected error after {elapsed_time:.3f}s during address search: {e}")
            raise HTTPException(
                status_code=500, detail="Error processing address search. Please try again."
            )

    @retry_with_backoff(
        max_retries=settings.SEARCH_MAX_RETRIES,
        backoff_base=settings.SEARCH_RETRY_BACKOFF_BASE,
        exceptions=(GeosupportError,),
    )
    def _search_with_retry(self, address: str) -> List[Dict[str, Any]]:
        """
        Search with retry logic for transient failures.

        Args:
            address: The address query to search

        Returns:
            List of suggestion dictionaries from Geosupport
        """
        # Use the suggest library to get autocomplete suggestions
        return self.suggest.suggestions(address)

    def _get_user_friendly_error(self, error: GeosupportError) -> str:
        """
        Convert Geosupport error codes to user-friendly messages.

        Args:
            error: The GeosupportError exception

        Returns:
            User-friendly error message
        """
        error_str = str(error).lower()

        # Common Geosupport error patterns
        if "invalid" in error_str or "not recognized" in error_str:
            return "Address not recognized. Please check your input and try again."
        elif "borough" in error_str:
            return "Please include a valid NYC borough in your search."
        elif "ambiguous" in error_str:
            return "Address is ambiguous. Please be more specific."
        else:
            return f"Address search error: {error}"

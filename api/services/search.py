import logging
import httpx
from typing import Any, Dict, List
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class SearchService:
    def __init__(self):
        """
        Initialize the search service using NYC Planning Labs GeoSearch API
        """
        self.base_url = "https://geosearch.planninglabs.nyc/v2/autocomplete"
        
    async def search_address(self, address: str) -> Dict[str, Any]:
        """
        Search for address suggestions using NYC Planning Labs GeoSearch API.
        
        Args:
            address: The address query to search
            
        Returns:
            GeoJSON FeatureCollection with address suggestions
            
        Raises:
            HTTPException: If error occurs during search
        """
        logger.info(f"Searching for address: {address}")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.base_url, 
                    params={"text": address}
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during address search: {e}")
            raise HTTPException(status_code=500, detail="Error connecting to GeoSearch API")
        except Exception as e:
            logger.error(f"Error during address search: {e}")
            raise HTTPException(status_code=500, detail="Error processing address search.") 
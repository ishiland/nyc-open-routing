from fastapi import APIRouter, Depends, Query
from typing import Dict, Any

from services.search import SearchService
from dependencies import get_search_service

router = APIRouter(
    prefix="/api",
    tags=["search"],
)

@router.get("/search", response_model=Dict[str, Any])
async def address_search(
    address: str = Query(..., description="Address to search for suggestions"),
    search_service: SearchService = Depends(get_search_service)
):
    """
    Provides address suggestions based on the provided input.
    Returns a GeoJSON FeatureCollection with matching address suggestions.
    """
    return await search_service.search_address(address) 
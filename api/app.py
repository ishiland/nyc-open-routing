import os
import logging
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Any, Dict, Optional
from sqlalchemy import create_engine, text
from shapely import wkb, geometry
from geosupport import Geosupport
from suggest import GeosupportSuggest

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize geosupport services
g = Geosupport()
s = GeosupportSuggest(g)

# Set up database connection using environment variables
user = os.getenv('POSTGRES_USER')
password = os.getenv('POSTGRES_PASSWORD')
database = os.getenv('POSTGRES_DB')
host = os.getenv('POSTGRES_HOST')
port = os.getenv('POSTGRES_PORT')
DATABASE_URI = f"postgresql+psycopg://{user}:{password}@{host}:{port}/{database}"
engine = create_engine(DATABASE_URI)

app = FastAPI(title="Routing Application")

def dump_geo(data):
    """
    Convert a WKB hex string to a GeoJSON-like mapping.
    """
    if data is None:
        return None
    p = wkb.loads(data, hex=True)
    return geometry.mapping(p)

# Define Pydantic models for response schema
class Properties(BaseModel):
    seq: int
    street: Optional[str] = None
    distance: Optional[float] = None  # in feet
    travel_time: Optional[float] = None

class Feature(BaseModel):
    properties: Properties
    geometry: Dict[str, Any]

@app.get("/api/route", response_model=List[Feature])
def get_route(
    orig: str = Query(..., description="Origin address or identifier"),
    dest: str = Query(..., description="Destination address or identifier"),
    mode: str = Query(..., description="Routing mode: drive, bike, or walk")
):
    """
    Get a route between the origin and destination based on the specified mode.
    """
    mode = mode.lower()
    if mode == 'drive':
        sql = text("SELECT * FROM getdrivingroute(:orig, :dest)")
    elif mode == 'bike':
        sql = text("SELECT * FROM getbikingroute(:orig, :dest)")
    elif mode == 'walk':
        sql = text("SELECT * FROM getwalkingroute(:orig, :dest)")
    else:
        raise HTTPException(status_code=400, detail="Invalid mode specified. Choose 'drive', 'bike', or 'walk'.")
    
    try:
        with engine.connect() as conn:
            result = conn.execute(sql, {"orig": orig, "dest": dest})
            rows = result.fetchall()
    except Exception as e:
        logger.error(f"Error executing route query: {e}")
        raise HTTPException(status_code=500, detail="Error processing route request.")
    
    features = []
    for row in rows:
        # Convert row to dict if not already a mapping.
        row_dict = dict(row)
        feature = Feature(
            properties=Properties(
                seq=row_dict.get('seq'),
                street=row_dict.get('street'),
                distance=row_dict.get('distance'),
                travel_time=row_dict.get('travel_time')
            ),
            geometry=dump_geo(row_dict.get('geom'))
        )
        features.append(feature)
    return features

@app.get("/api/search")
def address_search(address: str = Query(..., description="Address to search for suggestions")):
    """
    Provides address suggestions based on the provided input.
    """
    logger.info(f"Searching for address: {address}")
    try:
        suggestions = s.suggestions(address)
    except Exception as e:
        logger.error(f"Error during address search: {e}")
        raise HTTPException(status_code=500, detail="Error processing address search.")
    return suggestions

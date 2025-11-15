#!/usr/bin/env python3
"""
Debug script to test why biking route returns 0 segments via API but works in database.
"""

from sqlalchemy import create_engine, text
from utils.geo import dump_geo
import os
import sys

# Create engine
db_uri = os.environ.get('DATABASE_URI', 'postgresql://postgres:postgres@db:5432/routing')
engine = create_engine(db_uri)

# Test biking route
sql = text('SELECT * FROM getbikingroute(:orig_lon, :orig_lat, :dest_lon, :dest_lat)')

print("Testing biking route:")
print("Origin: -73.982945, 40.701925")
print("Destination: -73.998838, 40.74234")
print("-" * 50)

try:
    with engine.connect() as conn:
        result = conn.execute(sql, {
            'orig_lon': -73.982945,
            'orig_lat': 40.701925,
            'dest_lon': -73.998838,
            'dest_lat': 40.74234
        })
        rows = result.fetchall()
        print(f'✓ Database returned {len(rows)} rows')

        if len(rows) > 0:
            print("\nFirst row details:")
            first_row = rows[0]
            print(f"  Raw row: {first_row}")

            # Check if row has _mapping attribute
            if hasattr(first_row, '_mapping'):
                row_dict = dict(first_row._mapping)
                print(f"  Keys: {list(row_dict.keys())}")
                print(f"  Seq: {row_dict.get('seq')}")
                print(f"  Street: {row_dict.get('street')}")
                print(f"  Distance: {row_dict.get('distance')}")
                print(f"  Travel time: {row_dict.get('travel_time')}")
                print(f"  Geom type: {type(row_dict.get('geom'))}")
                print(f"  Geom value (first 100 chars): {str(row_dict.get('geom'))[:100]}")

                # Test dump_geo function
                try:
                    geom = row_dict.get('geom')
                    if geom:
                        print("\n  Testing dump_geo conversion...")
                        geo_json = dump_geo(geom)
                        if geo_json:
                            print(f"  ✓ dump_geo SUCCESS")
                            print(f"    Type: {geo_json.get('type')}")
                            print(f"    Coords (first 2): {geo_json.get('coordinates', [])[:2]}")
                        else:
                            print(f"  ✗ dump_geo returned None/empty")
                    else:
                        print(f"  ✗ Geom is None")
                except Exception as e:
                    print(f"  ✗ dump_geo FAILED: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                print(f"  Row has no _mapping attribute")
                print(f"  Row type: {type(first_row)}")
        else:
            print("\n✗ No rows returned from database!")

except Exception as e:
    print(f"\n✗ ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 50)
print("Testing complete")

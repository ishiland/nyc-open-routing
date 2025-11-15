-- SQL query for driving route with traffic awareness
-- Traffic data imported on: 2025-11-13
SELECT * FROM getdrivingroute_with_traffic(
    :orig_lat, :orig_lon, :dest_lat, :dest_lon, :hour, :day_of_week
);

/*
This function returns a table with the following columns:
- seq: INT (sequence number)
- id: VARCHAR (street segment ID)
- street: VARCHAR (street name)
- travel_time: FLOAT (travel time in minutes, adjusted for traffic)
- distance: FLOAT (distance in feet)
- traffic_factor: FLOAT (traffic impact multiplier)
- turn_instruction: TEXT (turn-by-turn directions)
- geom: GEOMETRY (line geometry in WGS84/EPSG:4326)

Traffic factors represent time-of-day congestion:
- 1.0 = Free flow (no traffic impact)
- 1.2 = Light traffic (20% slower)
- 1.5 = Moderate traffic (50% slower)
- 2.0 = Heavy traffic (100% slower)
- 3.0 = Severe congestion (200% slower)
*/ 
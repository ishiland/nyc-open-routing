-- SQL query for driving route with traffic
SELECT * FROM getdrivingroute_with_traffic(
    :orig_lon, :orig_lat, :dest_lon, :dest_lat, :hour, :day_of_week
);

/* 
This function returns a table with the following columns:
- seq: INT (sequence number)
- id: VARCHAR (street segment ID)
- street: VARCHAR (street name)
- travel_time: FLOAT (travel time in seconds)
- distance: FLOAT (distance in feet)
- traffic_factor: FLOAT (traffic impact factor)
- geom: GEOMETRY (line geometry)

The traffic_factor has these interpretations:
- 1.0 = No traffic impact (free flow/default) or no data available
- 1.2 = Light traffic (20% slowdown)
- 1.5 = Medium traffic (50% slowdown)
- 2.0 = Heavy traffic (doubles travel time)
- 3.0 = Very heavy traffic (triples travel time)
*/ 
# NYC Open Routing - Data Importer

This module imports NYC LION data and creates a routable network for pgRouting.

## Features

- Creates a routable network from NYC LION data
- Calculates travel times for driving, walking, and biking
- Handles grade-separated intersections with turn restrictions
- Fixes network fragmentation issues

## Usage

```bash
# Import using default LION version
./import-lion.sh

# Import specific LION version
./import-lion.sh 23a
```

## Available Routing Functions

After importing the data, the following routing functions will be available:

### Standard Routing

- `getdrivingroute(start_lat, start_lon, end_lat, end_lon)` - Calculate driving route
- `getbikingroute(start_lat, start_lon, end_lat, end_lon)` - Calculate biking route
- `getwalkingroute(start_lat, start_lon, end_lat, end_lon)` - Calculate walking route

### Traffic-Aware Routing

Traffic data is populated automatically by the `TrafficRefreshService` at runtime (fetches TRANSCOM speed data). No import flag needed.

- `getdrivingroute_with_traffic(start_lat, start_lon, end_lat, end_lon, hour, day_of_week)` - Calculate driving route considering traffic data for specified time

## Example Queries

Basic routing:
```sql
SELECT * FROM getdrivingroute(40.7128, -74.0060, 40.7580, -73.9855);
```

Traffic-based routing for 8 AM on Monday:
```sql
SELECT * FROM getdrivingroute_with_traffic(40.7128, -74.0060, 40.7580, -73.9855, 8, 1);
```

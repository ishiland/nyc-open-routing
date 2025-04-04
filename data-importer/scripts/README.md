# NYC Open Routing - Data Importer

This module imports NYC LION data and creates a routable network for pgRouting.

## Features

- Creates a routable network from NYC LION data
- Calculates travel times for driving, walking, and biking
- Handles grade-separated intersections with turn restrictions
- Fixes network fragmentation issues
- Supports traffic volume data integration for time-based routing

## Usage

### Basic Import

```bash
# Import using default LION version
./import-lion.sh

# Import specific LION version
./import-lion.sh 23a
```

### Import with Traffic Data

You can import traffic volume data to enable time-based routing with traffic considerations:

```bash
# Automatically download traffic data from NYC Open Data
./import-lion.sh 23a --download-traffic

# Or use a local traffic data file
./import-lion.sh 23a --traffic-file /path/to/traffic_data.csv
```

The traffic data should be in the NYC DOT Automated Traffic Volume Counts format, available from:
https://data.cityofnewyork.us/api/views/7ym2-wayt/rows.csv

### All Options

```
Usage: ./import-lion.sh [LION_VERSION] [OPTIONS]
Options:
  --download-traffic  Download latest traffic volume data from NYC Open Data
  --traffic-file PATH  Use local traffic data file at PATH

Examples:
  ./import-lion.sh 23a                            # Import LION 23a without traffic data
  ./import-lion.sh 23a --download-traffic         # Import LION 23a and download traffic data
  ./import-lion.sh 23a --traffic-file data.csv    # Import LION 23a with local traffic data
```

## Available Routing Functions

After importing the data, the following routing functions will be available:

### Standard Routing

- `getdrivingroute(start_lat, start_lon, end_lat, end_lon)` - Calculate driving route
- `getbikingroute(start_lat, start_lon, end_lat, end_lon)` - Calculate biking route
- `getwalkingroute(start_lat, start_lon, end_lat, end_lon)` - Calculate walking route

### Traffic-Based Routing (if traffic data was imported)

- `getdrivingroute_with_traffic(start_lat, start_lon, end_lat, end_lon, hour, day_of_week)` - Calculate driving route considering traffic data for specified time
- `getdrivingroute_current_traffic(start_lat, start_lon, end_lat, end_lon)` - Calculate driving route considering current time's traffic data

#### Parameters for traffic-based routing:

- `hour`: Hour of day (0-23)
- `day_of_week`: Day of week (1=Monday, 7=Sunday)

## Example Queries

Basic routing:
```sql
SELECT * FROM getdrivingroute(40.7128, -74.0060, 40.7580, -73.9855);
```

Traffic-based routing for 8 AM on Monday:
```sql
SELECT * FROM getdrivingroute_with_traffic(40.7128, -74.0060, 40.7580, -73.9855, 8, 1);
```

Current traffic conditions:
```sql
SELECT * FROM getdrivingroute_current_traffic(40.7128, -74.0060, 40.7580, -73.9855);
``` 
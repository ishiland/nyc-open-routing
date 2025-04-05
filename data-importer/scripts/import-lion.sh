#!/bin/bash
set -e

TRAFFIC_DATA_URL="https://data.cityofnewyork.us/api/views/7ym2-wayt/rows.csv"
TRAFFIC_DATA_PATH="/data-imports/data/traffic_data.csv"

print_usage() {
  echo "Usage: $0 [LION_VERSION] [OPTIONS]"
  echo "Options:"
  echo "  --download-traffic  Download latest traffic volume data from NYC Open Data"
  echo "  --traffic-file PATH  Use local traffic data file at PATH"
  echo ""
  echo "Examples:"
  echo "  $0 23a                            # Import LION 23a without traffic data"
  echo "  $0 23a --download-traffic         # Import LION 23a and download traffic data"
  echo "  $0 23a --traffic-file data.csv    # Import LION 23a with local traffic data"
}

# Parse arguments
if [ "$#" -eq "0" ]; then
  LION=$DEFAULT_LION
  TRAFFIC_DATA=""
  DOWNLOAD_TRAFFIC=false
else
  LION=$1
  shift

  # Process additional arguments
  TRAFFIC_DATA=""
  DOWNLOAD_TRAFFIC=false
  
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --download-traffic)
        DOWNLOAD_TRAFFIC=true
        TRAFFIC_DATA="$TRAFFIC_DATA_PATH"
        shift
        ;;
      --traffic-file)
        if [ "$#" -gt 1 ]; then
          TRAFFIC_DATA="$2"
          shift 2
        else
          echo "Error: Missing path for --traffic-file"
          print_usage
          exit 1
        fi
        ;;
      --help)
        print_usage
        exit 0
        ;;
      *)
        echo "Error: Unknown option: $1"
        print_usage
        exit 1
        ;;
    esac
  done
fi

echo "Attempting to import LION $LION"

# Handle traffic data
if [ "$DOWNLOAD_TRAFFIC" = true ]; then
  # Check if traffic data file already exists
  if [ -f "$TRAFFIC_DATA" ]; then
    echo "Traffic data file already exists at $TRAFFIC_DATA"
    echo "Using existing traffic data file"
  else
    echo "Downloading traffic data from NYC Open Data..."
    mkdir -p "$(dirname "$TRAFFIC_DATA")"
    curl -o "$TRAFFIC_DATA" "$TRAFFIC_DATA_URL"
    if [ $? -ne 0 ]; then
      echo "Error downloading traffic data"
      TRAFFIC_DATA=""
    else
      echo "Traffic data downloaded to $TRAFFIC_DATA"
    fi
  fi
elif [ -n "$TRAFFIC_DATA" ]; then
  echo "Using traffic data from $TRAFFIC_DATA"
  if [ ! -f "$TRAFFIC_DATA" ]; then
    echo "Warning: Traffic data file not found at $TRAFFIC_DATA"
    TRAFFIC_DATA=""
  fi
fi

#================================
# Download Lion
#================================
# only download if directory doesnt exists
if [ ! -d "/data-imports/data/lion_${LION}" ]; then
  echo "Downloading LION data version $LION..."
  mkdir -p "/data-imports/data/lion_${LION}"
  # example url: https://s-media.nyc.gov/agencies/dcp/assets/files/zip/data-tools/bytes/nyclion_23a.zip
  curl -o /data-imports/data/lion_"${LION}"/lion.zip https://s-media.nyc.gov/agencies/dcp/assets/files/zip/data-tools/bytes/nyclion_"${LION}".zip &&
    unzip /data-imports/data/lion_"${LION}"/lion.zip -d /data-imports/data/lion_"${LION}" &&
    rm /data-imports/data//lion_"${LION}"/lion.zip
fi

## ================================
## load Lion data with ogr2ogr
## ================================
# ./scripts/wait-for-it.sh "$POSTGRES_HOST":5432 -- echo "database is up"

# need to create extensions on first go
psql --command="create extension if not exists postgis;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB
psql --command="create extension if not exists pgrouting;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB

CNX="user=$POSTGRES_USER host=$POSTGRES_HOST dbname=$POSTGRES_DB password=$POSTGRES_PASSWORD port=5432"
GDB=/data-imports/data/lion_${LION}/lion/lion.gdb
# load only required fields
FIELDS="segmentid,join_id,street,trafdir,nodelevelf,nodelevelt,posted_speed,number_travel_lanes,featuretyp,bikelane,bike_trafdir,nonped,segmenttyp,segmentid,rw_type"
echo "Importing lion data..."
ogr2ogr -progress \
  --config PG_USE_COPY YES \
  -lco GEOMETRY_NAME=the_geom \
  -overwrite \
  -select $FIELDS \
  -f 'PostgreSQL' PG:"$CNX" \
  -nlt CONVERT_TO_LINEAR "$GDB" "lion"

## ================================
## create routing network
## ================================
# Export traffic data path if provided
if [ -n "$TRAFFIC_DATA" ]; then
  echo "Setting TRAFFIC_DATA_FILE environment variable to: $TRAFFIC_DATA"
  export TRAFFIC_DATA_FILE="$TRAFFIC_DATA"
fi

echo "Running create_network.py..."
python3 /data-imports/scripts/create_network.py

# Cleanup env var
if [ -n "$TRAFFIC_DATA" ]; then
  unset TRAFFIC_DATA_FILE
fi

# Only clean up downloaded traffic data if we downloaded it in this run and it didn't exist before
if [ "$DOWNLOAD_TRAFFIC" = true ] && [ ! -f "$TRAFFIC_DATA_PATH" ]; then
  rm -f "$TRAFFIC_DATA"
  echo "Temporary traffic data file removed"
fi

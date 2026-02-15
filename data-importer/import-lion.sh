#!/bin/bash
set -e

DEFAULT_LION="25a"


print_usage() {
  echo "Usage: $0 [LION_VERSION]"
  echo ""
  echo "Examples:"
  echo "  $0           # Import default LION version ($DEFAULT_LION)"
  echo "  $0 23a       # Import LION 23a"
}

# Parse arguments
if [ "$#" -eq "0" ]; then
  LION=$DEFAULT_LION
elif [ "$1" = "--help" ]; then
  print_usage
  exit 0
elif [[ "$1" == --* ]]; then
  echo "Error: Unknown option: $1"
  print_usage
  exit 1
else
  LION=$1
fi

echo "Attempting to import LION $LION"

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
    rm /data-imports/data/lion_"${LION}"/lion.zip
fi

## ================================
## load Lion data with ogr2ogr
## ================================

# need to create extensions on first go
psql --command="create extension if not exists postgis;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB
psql --command="create extension if not exists pgrouting;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB

CNX="user=$POSTGRES_USER host=$POSTGRES_HOST dbname=$POSTGRES_DB password=$POSTGRES_PASSWORD port=5432"
GDB=/data-imports/data/lion_${LION}/lion/lion.gdb
# load only required fields (removed duplicate segmentid, added status)
FIELDS="segmentid,join_id,street,trafdir,nodelevelf,nodelevelt,posted_speed,number_travel_lanes,featuretyp,bikelane,bike_trafdir,nonped,segmenttyp,rw_type,status"
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
echo "Running create_network.py..."
python3 /data-imports/src/create_network.py

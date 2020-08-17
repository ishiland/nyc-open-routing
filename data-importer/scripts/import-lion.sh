#!/bin/bash

if [ "$#" -eq "0" ]; then
  LION=$DEFAULT_LION
else
  LION=$1
fi

echo "Attempting to import LION $LION"

#================================
# Download Lion
#================================
# only download if directory doesnt exists
if [ ! -d "/data-imports/data/lion_${LION}" ]; then

  mkdir "/data-imports/data/lion_${LION}"

  curl -o /data-imports/data/lion_"${LION}"/lion.zip https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyclion_"${LION}".zip &&
    unzip /data-imports/data/lion_"${LION}"/lion.zip -d /data-imports/data/lion_"${LION}" &&
    rm /data-imports/data//lion_"${LION}"/lion.zip
fi

## ================================
## load Lion data with ogr2ogr
## ================================
./scripts/wait-for-it.sh "$POSTGRES_HOST":5432 -- echo "database is up"

# need to create extensions on first go
psql --command="create extension postgis;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB
psql --command="create extension pgrouting;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB

CNX="user=$POSTGRES_USER host=$POSTGRES_HOST dbname=$POSTGRES_DB password=$POSTGRES_PASSWORD port=5432"
GDB=/data-imports/data/lion_${LION}/lion/lion.gdb
# load only required fields
FIELDS="join_id,street,trafdir,nodelevelf,nodelevelt,posted_speed,number_travel_lanes,featuretyp,bikelane,bike_trafdir,nonped,segmenttyp,segmentid,rw_type"
echo "Loading lion data...this may take several minutes."
ogr2ogr -progress \
  --config PG_USE_COPY YES \
  -t_srs EPSG:4326 -s_srs EPSG:2263 \
  -lco GEOMETRY_NAME=the_geom \
  -overwrite \
  -select $FIELDS \
  -f 'PostgreSQL' PG:"$CNX" \
  -nlt CONVERT_TO_LINEAR "$GDB" "lion"

## ================================
## create routing network
## ================================
python3 ./scripts/create_network.py

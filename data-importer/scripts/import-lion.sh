#!/bin/bash
set -e

if [ "$#" -ne 1 ]; then
  LION=$1
else
  LION=$DEFAULT_LION
fi

echo "Attempting to import LION $LION"
psql --command="DROP TABLE IF EXISTS lion;" postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST/$POSTGRES_DB

#================================
# Download Lion
#================================
if [ -d "/data-imports/data/lion_${LION}" ]; then
  rm -r "/data-imports/data/lion_${LION}"
fi
mkdir "/data-imports/data/lion_${LION}"
curl -o /data-imports/data/lion_"${LION}"/lion.zip https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyclion_"${LION}".zip &&
  unzip /data-imports/data/lion_"${LION}"/lion.zip -d /data-imports/data/lion_"${LION}" &&
  rm /data-imports/data//lion_"${LION}"/lion.zip

## ================================
## load Lion data with ogr2ogr
## ================================
./scripts/wait-for-it.sh "$POSTGRES_HOST":5432 -- echo "database is up"

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

#fi

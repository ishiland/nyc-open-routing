#!/bin/bash

CNX="user=$POSTGRES_USER dbname=$POSTGRES_DB password=$POSTGRES_PASSWORD port=5432"
GDB=lion/lion.gdb

# load only required fields
FIELDS="join_id,street,trafdir,nodelevelf,nodelevelt,posted_speed,number_travel_lanes,featuretyp,bikelane,bike_trafdir,nonped,segmenttyp,segmentid,rw_type"

echo "Loading lion data...this may take several minutes."
ogr2ogr -progress  \
        --config PG_USE_COPY YES \
        -t_srs EPSG:4326 -s_srs EPSG:2263 \
        -lco GEOMETRY_NAME=the_geom \
        -overwrite \
        -skipfailures \
        -select $FIELDS \
        -f 'PostgreSQL' PG:"$CNX" \
        -nlt CONVERT_TO_LINEAR $GDB "lion" &
        export OGR_PID=$!

# If this script is killed, kill `ogr2ogr'.
trap "kill ${OGR_PID} 2> /dev/null" EXIT

# While ogr2ogr is running...
while kill -0 ${OGR_PID} 2> /dev/null; do
    echo " "
    sleep 10
done
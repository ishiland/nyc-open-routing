#!/bin/bash
set -e
#set -x # echo commands being executed

# download and load lion into database if not already downloaded
FILE_NAME=nyclion_${LION}.zip
if [ ! -f $FILE_NAME ]; then
    echo "Downloading ${FILE_NAME}"
    wget https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/${FILE_NAME}
    unzip ${FILE_NAME}
fi

# Use ogr2ogr to load lion.gdb data
CNX="user=$POSTGRES_USER dbname=$POSTGRES_DB password=$POSTGRES_PASSWORD port=5432"
GDB=lion/lion.gdb

# load only required fields and rows for routing
FIELDS="join_id,street,trafdir,nodelevelf,nodelevelt,posted_speed,number_travel_lanes,featuretyp,bikelane,bike_trafdir,nonped,segmenttyp,rw_type"

# remove SQL to enable fast feature count. This allows for progress flag.
# SQL="featuretyp IN ('0', 'A', '6', 'W', 'F') AND segmenttyp NOT IN ('G', 'F')"
# -where "$SQL"

echo "Loading lion data...this may take several minutes."
ogr2ogr -progress  \
        --config PG_USE_COPY YES \
        -t_srs EPSG:4326 -s_srs EPSG:2263 \
        -lco GEOMETRY_NAME=the_geom \
        -overwrite -skipfailures \
        -select $FIELDS \
        -f 'PostgreSQL' PG:"$CNX" \
        -nlt CONVERT_TO_LINEAR $GDB "lion"

#echo "Loading altnames..."
#ogr2ogr --config PG_USE_COPY YES -overwrite -skipfailures -f 'PostgreSQL' PG:"$CNX" $GDB "altnames"

#echo "loading nodes..."
#ogr2ogr --config PG_USE_COPY YES -t_srs EPSG:4326 -s_srs EPSG:2263 -lco GEOMETRY_NAME=the_geom -overwrite -skipfailures -f 'PostgreSQL' PG:"$CNX" $GDB "node"

#echo "loading node_stname..."
#ogr2ogr --config PG_USE_COPY YES -overwrite -skipfailures -f 'PostgreSQL' PG:"$CNX" $GDB "node_stname"

# run script to load data
cd ..
cd scripts
python3 lion.py
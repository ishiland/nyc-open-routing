#!/bin/bash
set -e

# download and load lion into database if not already downloaded
FILE_NAME=nyclion_${LION}.zip
if [ ! -f $FILE_NAME ]; then
    echo "Downloading ${FILE_NAME}"
    wget https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/${FILE_NAME}
    unzip ${FILE_NAME}
fi

#echo "Loading altnames..."
#ogr2ogr --config PG_USE_COPY YES -overwrite -skipfailures -f 'PostgreSQL' PG:"$CNX" $GDB "altnames"

#echo "loading nodes..."
#ogr2ogr --config PG_USE_COPY YES -t_srs EPSG:4326 -s_srs EPSG:2263 -lco GEOMETRY_NAME=the_geom -overwrite -skipfailures -f 'PostgreSQL' PG:"$CNX" $GDB "node"

#echo "loading node_stname..."
#ogr2ogr --config PG_USE_COPY YES -overwrite -skipfailures -f 'PostgreSQL' PG:"$CNX" $GDB "node_stname"


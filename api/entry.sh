#!/bin/sh
set -e

GEOSUPPORT_DIRECTORY=version-19b_19.2

if [ -d /api/geosupport ]
then
    echo "Geosupport directory detected, not downloading."
else
    echo "Downloading Geosupport"
    mkdir geosupport
    curl -O https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/linux_geo19b_19_2.zip \
    && unzip *.zip -d /api/geosupport \
    && rm *.zip
fi


export GEOFILES=/api/geosupport/${GEOSUPPORT_DIRECTORY}/fls/
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/api/geosupport/${GEOSUPPORT_DIRECTORY}/lib/

python3 api.py

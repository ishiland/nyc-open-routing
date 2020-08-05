#!/bin/sh
set -e

# TODO: write a function to retrieve the downloaded geosupport sub-directory name.
# The $LION env var can then be used to get the same version of Geosupport.

GEOSUPPORT_DIRECTORY=version-20c_20.3
# https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/linux_geo20c_20_3.zip
if [ -d /api/geosupport ]; then
    echo "Geosupport directory detected, not downloading.";
else
    echo "Downloading Geosupport"
    mkdir geosupport
    curl -O https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/linux_geo20c_20_3.zip \
    && unzip *.zip -d /api/geosupport \
    && rm *.zip;
fi

export GEOFILES=/api/geosupport/${GEOSUPPORT_DIRECTORY}/fls/
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/api/geosupport/${GEOSUPPORT_DIRECTORY}/lib/

python3 app.py

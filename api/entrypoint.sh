#!/bin/bash

geosupport_directory=$(cd /api/geosupport || exit;ls -d -- */)

echo "Geosuport directory is ${geosupport_directory}"

export GEOFILES=/api/geosupport/${geosupport_directory}/fls/
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/api/geosupport/${geosupport_directory}/lib/

python3 app.py
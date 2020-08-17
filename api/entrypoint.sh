#!/bin/bash

GEOSUPPORT=$DEFAULT_GEOSUPPORT

declare -A version_lookup
version_lookup=(["a"]="1" ["b"]="2" ["c"]="3" ["d"]="4")
version_letter=${GEOSUPPORT:2:1}
version_number="${version_lookup[$version_letter]}"
geosupport_directory="version-${GEOSUPPORT}_${GEOSUPPORT:0:2}.${version_number}"

if [ ! -d "/api/geosupport/${geosupport_directory}" ]; then
  echo "Installing Geosupport version ${GEOSUPPORT}..."
  # example URL: https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/linux_geo20c_20_3.zip
  url_endpoint=linux_geo"${GEOSUPPORT}"_"${GEOSUPPORT:0:2}"_"${version_number}".zip
  echo "url endpoint is $url_endpoint"
  curl -o /api/geosupport/geosupport.zip https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/"${url_endpoint}" &&
    unzip /api/geosupport/geosupport.zip -d /api/geosupport &&
    rm /api/geosupport/geosupport.zip
fi

export GEOFILES=/api/geosupport/${geosupport_directory}/fls/
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/api/geosupport/${geosupport_directory}/lib/

python3 app.py

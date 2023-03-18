#!/bin/bash

GEOSUPPORT=$DEFAULT_GEOSUPPORT

mkdir -p geosupport

declare -A version_lookup
version_lookup=(["a"]="1" ["b"]="2" ["c"]="3" ["d"]="4")
version_letter=${GEOSUPPORT:2:1}
version_number="${version_lookup[$version_letter]}"
geosupport_directory="version-${GEOSUPPORT}_${GEOSUPPORT:0:2}.${version_number}"

if [ ! -d "/api/geosupport/${geosupport_directory}" ]; then
  echo "Installing Geosupport version ${GEOSUPPORT}..."
  # example URL: https://s-media.nyc.gov/agencies/dcp/assets/files/zip/data-tools/bytes/linux_geo23a_23_1.zip
  url_endpoint=linux_geo"${GEOSUPPORT}"_"${GEOSUPPORT:0:2}"_"${version_number}".zip
  request_url="https://s-media.nyc.gov/agencies/dcp/assets/files/zip/data-tools/bytes/${url_endpoint}"
  echo "request url for geosupport is ${request_url}"
  curl -o /api/geosupport/geosupport.zip "${request_url}" &&
    unzip /api/geosupport/geosupport.zip -d /api/geosupport &&
    rm /api/geosupport/geosupport.zip
fi

export GEOFILES=/api/geosupport/${geosupport_directory}/fls/
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/api/geosupport/${geosupport_directory}/lib/

python3 app.py

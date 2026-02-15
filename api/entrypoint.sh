#!/bin/bash
set -euo pipefail

# Ensure DEFAULT_GEOSUPPORT is set
if [ -z "${DEFAULT_GEOSUPPORT:-}" ]; then
  echo "Error: DEFAULT_GEOSUPPORT environment variable is not set." >&2
  exit 1
fi

GEOSUPPORT="$DEFAULT_GEOSUPPORT"
INSTALL_DIR="/home/api/gde"

# Create the geosupport directory inside the API volume
mkdir -p "$INSTALL_DIR"

# Define version lookup
declare -A version_lookup
version_lookup=(["a"]="1" ["b"]="2" ["c"]="3" ["d"]="4")

# Extract the version letter and corresponding minor number
version_letter=${GEOSUPPORT:2:1}
version_number="${version_lookup[$version_letter]}"
geosupport_directory="version-${GEOSUPPORT}_${GEOSUPPORT:0:2}.${version_number}"

# Download and extract Geosupport if not already installed
if [ ! -d "${INSTALL_DIR}/${geosupport_directory}" ]; then
  echo "Installing Geosupport version ${GEOSUPPORT} to ${INSTALL_DIR}/${geosupport_directory}..."
  # Build URL endpoint (e.g., linux_geo25a_25.1.zip)
  url_endpoint="linux_geo${GEOSUPPORT}_${GEOSUPPORT:0:2}.${version_number}.zip"
  request_url="https://s-media.nyc.gov/agencies/dcp/assets/files/zip/data-tools/bytes/geosupport/${url_endpoint}"
  echo "Request URL for Geosupport: ${request_url}"
  
  curl -L -o "$INSTALL_DIR/geosupport.zip" "${request_url}" &&
    unzip "$INSTALL_DIR/geosupport.zip" -d "$INSTALL_DIR" &&
    rm "$INSTALL_DIR/geosupport.zip"
fi

export GEOFILES="${INSTALL_DIR}/${geosupport_directory}/fls/"
export LD_LIBRARY_PATH="${INSTALL_DIR}/${geosupport_directory}/lib/"


uvicorn main:app --host 0.0.0.0 --port 5000 --reload
#!/bin/sh
set -e

host=postgis
port=5432

echo -n "waiting for TCP connection to ${host}:${port}..."

while ! nc -w 1 ${host} ${port} 2>/dev/null
do
  echo -n .
  sleep 5
done

echo 'postgres ready'

npm run start
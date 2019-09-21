#!/bin/sh

echo "Waiting for postgis on port ${POSTGRES_PORT}..."

while ! nc -z postgis ${POSTGRES_PORT}; do
  sleep 0.1
done

echo "PostgreSQL started"

npm start
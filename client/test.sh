#!/bin/bash

server_host=postgis
sleep_seconds=5

while true; do
    echo -n "Checking $server_host status... "

    output=$(echo "" | curl $server_host:5432)

    if [ "$output" != "RUNNING" ]
    then
        echo "$server_host is running and ready to process requests."
        break
    fi

    echo "$server_host is warming up. Trying again in $sleep_seconds seconds..."
    sleep $sleep_seconds
done
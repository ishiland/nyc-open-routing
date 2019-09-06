FROM mdillon/postgis
ENV PYTHONUNBUFFERED 1

ARG LION
ENV LION ${LION}
ENV GDB lion/lion/lion.gdb

# pgrouting
RUN apt-get update &&\
    apt-get install -y --no-install-recommends \
    postgresql-${PG_MAJOR}-pgrouting

# download utils
RUN apt-get install -y \
    unzip \
    wget

# gdal
RUN apt-get install -y binutils libproj-dev gdal-bin

# pip 3
RUN apt-get install -y python3-pip

RUN pwd
RUN ls

COPY ./requirements.txt ./requirements.txt
RUN pip3 install -r ./requirements.txt

# download directory
RUN mkdir lion
WORKDIR /lion

# copy build script
COPY ./build.sh /docker-entrypoint-initdb.d/x_build.sh

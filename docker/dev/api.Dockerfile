FROM osgeo/gdal:ubuntu-small-3.1.0
ENV PYTHONUNBUFFERED 1
ARG GEOSUPPORT
ENV GEOSUPPORT=${GEOSUPPORT}

RUN echo 'geofiles path is ' $GEOSUPPORT

RUN apt-get install -y \
            python3-pip \
            libpq-dev \
            python-dev

RUN mkdir api
COPY . /api/
WORKDIR /api

RUN chmod +x ./install_geosupport.sh
RUN ./install_geosupport.sh

RUN pip3 install --no-cache-dir -r requirements.txt

CMD ["sh", "./entrypoint.sh"]

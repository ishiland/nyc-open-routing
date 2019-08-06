FROM osgeo/gdal:alpine-normal-latest
ENV PYTHONUNBUFFERED 1

#RUN apk update && \
#    apk add --virtual build-deps gcc python-dev musl-dev && \
#    apk add postgresql-dev && \
#    apk add libpq && \
#    apk add python3-dev


RUN apk update && apk add \
    --virtual build-deps gcc python-dev musl-dev \
    postgresql-dev \
    libpq \
    python3-dev

## Installing build dependencies
#RUN apk add --virtual .build-deps gcc python-dev musl-dev postgresql-dev

#RUN apt-get update && apt-get install --yes libgdal-dev \
#  && apt-get install -y wget \
#  && apt-get install unzip \
#  && rm -rf /var/lib/apt/lists/*

##RUN apt-get install libgdal-dev
#RUN export CPLUS_INCLUDE_PATH=/usr/include/gdal
#RUN export C_INCLUDE_PATH=/usr/include/gdal

RUN mkdir api
COPY . /api/
WORKDIR /api

RUN pip3 install --no-cache-dir -r requirements.txt

ENTRYPOINT ["python3"]
CMD ["api.py"]

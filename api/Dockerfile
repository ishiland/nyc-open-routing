FROM osgeo/gdal:alpine-normal-latest
ENV PYTHONUNBUFFERED 1

RUN apk update && apk add \
    --virtual build-deps gcc python-dev musl-dev \
    postgresql-dev \
    libpq \
    python3-dev \
    curl

RUN mkdir api
COPY . /api/
WORKDIR /api

RUN pip3 install --no-cache-dir -r requirements.txt

ENTRYPOINT ["./entrypoint.sh"]

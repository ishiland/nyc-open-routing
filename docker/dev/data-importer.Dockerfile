FROM osgeo/gdal:ubuntu-small-3.1.0
ENV PYTHONUNBUFFERED 1

RUN apt-get update

RUN apt-get install -y \
            python3-pip \
            libpq-dev \
            python-dev \
            postgresql-client

RUN mkdir data-imports
COPY . /data-imports/
WORKDIR /data-imports

RUN chmod +x ./scripts/import-lion.sh

RUN pip3 install --no-cache-dir -r requirements.txt

CMD ["sh", "./scripts/entrypoint.sh"]
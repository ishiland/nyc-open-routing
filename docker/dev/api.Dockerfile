FROM osgeo/gdal:ubuntu-small-3.1.0
ENV PYTHONUNBUFFERED 1

RUN apt-get install -y \
            python3-pip \
            libpq-dev \
            python-dev

RUN mkdir api
COPY . /api/
WORKDIR /api

#RUN chmod +x ./entrypoint.sh

RUN pip3 install --no-cache-dir -r requirements.txt

CMD ["bash", "./entrypoint.sh"]

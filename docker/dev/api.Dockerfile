FROM osgeo/gdal:ubuntu-small-3.4.0
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    python3-dev \
    gcc \
    libpq-dev \
    postgresql-client \
    && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir api
COPY app.py requirements.txt entrypoint.sh /api/
WORKDIR /api

RUN pip3 install --no-cache-dir -r requirements.txt

CMD ["bash", "entrypoint.sh"]

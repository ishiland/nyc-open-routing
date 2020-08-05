FROM thinkwhere/gdal-python:3.7-shippable
ENV PYTHONUNBUFFERED 1

RUN mkdir api
COPY . /api/
WORKDIR /api

RUN pip3 install --no-cache-dir -r requirements.txt

ENTRYPOINT ["./entrypoint.sh"]

FROM ghcr.io/osgeo/gdal:ubuntu-small-3.13.0

ARG PYTHON_VERSION=3.11
ARG DEBIAN_FRONTEND=noninteractive

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV APP_HOME=/home/api
ENV PYTHONPATH="${PYTHONPATH}:${APP_HOME}"

RUN apt-get update && apt-get install -y software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y --no-install-recommends \
    python${PYTHON_VERSION} \
    python${PYTHON_VERSION}-dev \
    python${PYTHON_VERSION}-distutils \
    gcc \
    libpq-dev \
    postgresql-client \
    && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install pip for the specified Python version
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python${PYTHON_VERSION}

# Create aliases for python3 and pip3
RUN ln -sf /usr/bin/python${PYTHON_VERSION} /usr/bin/python3
RUN ln -sf /usr/bin/pip${PYTHON_VERSION} /usr/bin/pip3

WORKDIR $APP_HOME

# Copy entire API directory structure (modular architecture)
COPY . ${APP_HOME}

# install dependencies via pip
RUN apt-get remove -y python3-numpy || true
RUN pip3 install --no-cache-dir --force-reinstall --ignore-installed numpy -r requirements.txt

CMD ["bash", "entrypoint.sh"]

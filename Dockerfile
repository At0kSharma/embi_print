FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# System deps (add headless raster→vector tools)
RUN apt-get update && apt-get install -y \
    inkscape \
    python3 \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    git \
    wget \
    unzip \
    xvfb \
    dbus-x11 \
    libgtk-3-0 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    imagemagick \
    potrace \
    && rm -rf /var/lib/apt/lists/*

# Install Ink/Stitch
RUN mkdir -p /root/.config/inkscape/extensions && \
git clone https://github.com/inkstitch/inkstitch.git /tmp/inkstitch && \
cp -r /tmp/inkstitch/* /root/.config/inkscape/extensions/ && \
pip3 install --no-cache-dir pystitch svgpathtools pyembroidery pillow

WORKDIR /app
COPY convert.py /app/convert.py
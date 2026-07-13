#!/usr/bin/env bash
set -Eeuo pipefail

BUILD_DIR="/opt/build"

echo "======================================="
echo " Install Build Dependencies"
echo "======================================="

export DEBIAN_FRONTEND=noninteractive

apt update

apt install -y \
    build-essential \
    git \
    patch \
    wget \
    curl \
    ca-certificates \
    perl \
    cmake \
    ninja-build \
    pkg-config \
    automake \
    autoconf \
    libtool \
    libmaxminddb-dev \
    zlib1g-dev \
    tar \
    xz-utils

echo
echo "======================================="
echo " Prepare Build Directory"
echo "======================================="

mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

echo
echo "======================================="
echo " Download Sources"
echo "======================================="

# NGINX 1.30.3
if [ ! -d nginx ]; then
    git clone \
        --depth=1 \
        --branch release-1.30.3 \
        https://github.com/nginx/nginx.git
fi

# OpenSSL 3.6.2
if [ ! -d openssl ]; then
    git clone \
        --depth=1 \
        --branch openssl-3.6.2 \
        https://github.com/openssl/openssl.git
fi

# Brotli
if [ ! -d ngx_brotli ]; then
    git clone \
        --recursive \
        https://github.com/google/ngx_brotli.git
fi

# Headers More
if [ ! -d headers-more-nginx-module ]; then
    git clone \
        https://github.com/openresty/headers-more-nginx-module.git
fi

# Cache Purge
if [ ! -d ngx_cache_purge ]; then
    git clone \
        https://github.com/FRiCKLE/ngx_cache_purge.git
fi

# GeoIP2
if [ ! -d ngx_http_geoip2_module ]; then
    git clone \
        https://github.com/leev/ngx_http_geoip2_module.git
fi

# zlib-ng
if [ ! -d zlib-ng ]; then
    git clone \
        --depth=1 \
        https://github.com/zlib-ng/zlib-ng.git
fi

# PCRE2
if [ ! -d pcre2-10.46 ]; then
    wget -q \
        -O pcre2-10.46.tar.gz \
        https://github.com/PCRE2Project/pcre2/releases/download/pcre2-10.46/pcre2-10.46.tar.gz

    tar xf pcre2-10.46.tar.gz
fi

# LuaJIT
if [ ! -d luajit2 ]; then
    git clone \
        --depth=1 \
        https://github.com/openresty/luajit2.git
fi

# ngx_devel_kit
if [ ! -d ngx_devel_kit ]; then
    git clone \
        --depth=1 \
        https://github.com/vision5/ngx_devel_kit.git
fi

# lua-nginx-module
if [ ! -d lua-nginx-module ]; then
    git clone \
        --depth=1 \
        https://github.com/openresty/lua-nginx-module.git
fi

# lua-resty-core
if [ ! -d lua-resty-core ]; then
    git clone \
        --depth=1 \
        https://github.com/openresty/lua-resty-core.git
fi

# lua-resty-ja4
if [ ! -d lua-resty-ja4 ]; then
    git clone \
        --depth=1 \
        https://github.com/nemethhh/lua-resty-ja4.git
fi

echo
echo "======================================="
echo " Source Tree Ready"
echo "======================================="

echo "NGINX       : ${BUILD_DIR}/nginx"
echo "OpenSSL     : ${BUILD_DIR}/openssl"
echo "PCRE2       : ${BUILD_DIR}/pcre2-10.46"
echo "zlib-ng     : ${BUILD_DIR}/zlib-ng"
echo "Brotli      : ${BUILD_DIR}/ngx_brotli"
echo "GeoIP2      : ${BUILD_DIR}/ngx_http_geoip2_module"
echo "Cache Purge : ${BUILD_DIR}/ngx_cache_purge"
echo "HeadersMore : ${BUILD_DIR}/headers-more-nginx-module"
echo "LuaJIT      : ${BUILD_DIR}/luajit2"
echo "Lua Module  : ${BUILD_DIR}/lua-nginx-module"
echo "Lua Core    : ${BUILD_DIR}/lua-resty-core"
echo "Lua JA4     : ${BUILD_DIR}/lua-resty-ja4"

echo
echo "Next Step:"
echo "cd ${BUILD_DIR}/nginx"
echo "./auto/configure ..."
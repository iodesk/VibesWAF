#!/usr/bin/env bash
set -Eeuo pipefail

BUILD_DIR="/opt/build"
export LUAJIT_LIB=/usr/local/lib
export LUAJIT_INC=/usr/local/include/luajit-2.1

echo "======================================="
echo " Build Brotli Libraries"
echo "======================================="

cd ${BUILD_DIR}/ngx_brotli/deps/brotli

rm -rf out
mkdir -p out

cmake \
    -S . \
    -B out \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF

cmake --build out -j$(nproc)

echo
echo "======================================="
echo " Build LuaJIT"
echo "======================================="

if ! ldconfig -p | grep -q libluajit; then
    echo "Building LuaJIT..."
    cd "${BUILD_DIR}/luajit2"
    make -j"$(nproc)"
    make install PREFIX=/usr/local
    ldconfig
fi

echo
echo "======================================="
echo " Install Lua Libraries"
echo "======================================="

rm -rf /usr/local/share/lua/5.1/resty
mkdir -p /usr/local/share/lua/5.1/resty

cp -a \
    /opt/build/lua-resty-core/lib/resty/. \
    /usr/local/share/lua/5.1/resty/

cp -a \
    /opt/build/lua-resty-ja4/lib/resty/. \
    /usr/local/share/lua/5.1/resty/

echo
echo "======================================="
echo " Clean Previous Build"
echo "======================================="

cd ${BUILD_DIR}/nginx

make clean >/dev/null 2>&1 || true
rm -rf objs

echo
echo "======================================="
echo " Configure NGINX"
echo "======================================="

CONFIGURE_ARGS=(

    --prefix=/etc/nginx
    --sbin-path=/usr/sbin/nginx
    --modules-path=/usr/lib/nginx/modules

    --conf-path=/etc/nginx/nginx.conf

    --error-log-path=/var/log/nginx/error.log
    --http-log-path=/var/log/nginx/access.log

    --pid-path=/run/nginx.pid
    --lock-path=/run/nginx.lock

    --with-threads
    --with-file-aio

    --with-pcre=/opt/build/pcre2-10.46
    --with-pcre-jit

    --with-openssl=/opt/build/openssl

    '--with-cc-opt=-I/usr/local/include/luajit-2.1'
    '--with-ld-opt=-L/usr/local/lib -Wl,-rpath,/usr/local/lib'

    --with-http_ssl_module
    --with-http_v2_module
    --with-http_v3_module

    --with-http_realip_module
    --with-http_stub_status_module
    --with-http_auth_request_module
    --with-http_slice_module
    --with-http_sub_module
    --with-http_secure_link_module
    --with-http_gzip_static_module

    --with-stream
    --with-stream_ssl_module
    --with-stream_realip_module

    --with-compat

    --add-module=/opt/build/ngx_devel_kit
    --add-module=/opt/build/lua-nginx-module

    --add-module=/opt/build/ngx_cache_purge

    --add-dynamic-module=/opt/build/ngx_brotli
    --add-dynamic-module=/opt/build/headers-more-nginx-module
    --add-dynamic-module=/opt/build/ngx_http_geoip2_module

)

./auto/configure "${CONFIGURE_ARGS[@]}"

echo
echo "======================================="
echo " Build NGINX"
echo "======================================="

make -j$(nproc)

echo
echo "======================================="
echo " Build Dynamic Modules"
echo "======================================="

make modules

echo
echo "======================================="
echo " Copy Dynamic Modules"
echo "======================================="

mkdir -p /usr/lib/nginx/modules

find objs -name "*.so" -exec cp -v {} /usr/lib/nginx/modules/ ';'

echo
echo "======================================="
echo " Build Complete"
echo "======================================="

echo
echo "NGINX Binary:"
echo "  ${BUILD_DIR}/nginx/objs/nginx"

echo
echo "Dynamic Modules:"
find /usr/lib/nginx/modules -name "*.so"

echo
echo "Suggested nginx.conf:"
echo
echo "load_module modules/ngx_http_geoip2_module.so;"
echo "load_module modules/ngx_stream_geoip2_module.so;"
echo "load_module modules/ngx_http_headers_more_filter_module.so;"
#echo "load_module modules/ngx_http_cache_purge_module.so;"
echo "load_module modules/ngx_http_brotli_filter_module.so;"
echo "load_module modules/ngx_http_brotli_static_module.so;"
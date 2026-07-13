#!/usr/bin/env bash
set -Eeuo pipefail

BUILD_DIR="/opt/build"
NGINX_BIN="${BUILD_DIR}/nginx/objs/nginx"
MODULE_DIR="/usr/lib/nginx/modules"

echo "======================================="
echo " Install Custom NGINX"
echo "======================================="

[[ -f "${NGINX_BIN}" ]] || {
echo "ERROR: ${NGINX_BIN} not found"
exit 1
}

########################################
# User
########################################

if ! getent group nginx >/dev/null; then
groupadd --system nginx
fi

if ! id nginx >/dev/null 2>&1; then
useradd 
--system 
--gid nginx 
--shell /usr/sbin/nologin 
--no-create-home 
nginx
fi

########################################
# Directories
########################################

mkdir -p 
/etc/nginx 
/etc/nginx/conf.d 
/etc/nginx/stream.d 
/etc/nginx/lua 
/usr/lib/nginx/modules 
/var/log/nginx 
/var/cache/nginx/client_temp 
/var/cache/nginx/proxy_temp 
/var/cache/nginx/fastcgi_temp 
/var/cache/nginx/uwsgi_temp 
/var/cache/nginx/scgi_temp 
/opt/certs/default

touch /var/log/nginx/access.log
touch /var/log/nginx/error.log

chown -R nginx:nginx 
/var/log/nginx 
/var/cache/nginx

########################################
# Install Binary
########################################

if [[ -f /usr/sbin/nginx ]]; then
cp /usr/sbin/nginx 
/usr/sbin/nginx.backup.$(date +%F-%H%M%S)
fi

install -m755 
"${NGINX_BIN}" 
/usr/sbin/nginx

########################################
# Install Modules
########################################

find "${BUILD_DIR}/nginx/objs" 
-name "*.so" 
-exec install -m644 {} "${MODULE_DIR}" ;

########################################
# Install Lua
########################################

mkdir -p /etc/nginx/lua

cat >/etc/nginx/lua/ssl.lua <<'EOF'
local ssl = require "ngx.ssl"
local cache = ngx.shared.cert_cache

local host, err = ssl.server_name()

if not host then
    return
end

local cert_der = cache:get(host .. ":cert")
local key_der  = cache:get(host .. ":key")

if not cert_der or not key_der then

    local cert_path = "/opt/certs/" .. host .. "/fullchain.pem"
    local key_path  = "/opt/certs/" .. host .. "/key.pem"

    local function read_file(path)
        local f = io.open(path, "r")
        if not f then
            return nil
        end

        local data = f:read("*a")
        f:close()

        return data
    end

    local cert_pem = read_file(cert_path)
    local key_pem  = read_file(key_path)

    if not cert_pem or not key_pem then

        cert_path = "/opt/certs/default/fullchain.pem"
        key_path  = "/opt/certs/default/key.pem"

        cert_pem = read_file(cert_path)
        key_pem  = read_file(key_path)

    end

    if not cert_pem or not key_pem then
        ngx.log(ngx.ERR,
            "SSL: unable to load certificate for host: ",
            host)

        return
    end

    cert_der, err = ssl.parse_pem_cert(cert_pem)

    if not cert_der then
        ngx.log(ngx.ERR,
            "SSL: parse cert failed for ",
            host,
            ": ",
            err)

        return
    end

    key_der, err = ssl.parse_pem_priv_key(key_pem)

    if not key_der then
        ngx.log(ngx.ERR,
            "SSL: parse key failed for ",
            host,
            ": ",
            err)

        return
    end

    cache:set(host .. ":cert", cert_der, 3600)
    cache:set(host .. ":key", key_der, 3600)

end

ssl.clear_certs()

assert(ssl.set_cert(cert_der))
assert(ssl.set_priv_key(key_der))
EOF

########################################
# mime.types
########################################

if [[ ! -f /etc/nginx/mime.types ]]; then
cp "${BUILD_DIR}/nginx/conf/mime.types" 
/etc/nginx/
fi

########################################
# proxy_params
########################################

cat >/etc/nginx/proxy_params <<'EOF'
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-JA4 $ja4;
proxy_set_header X-JA4H $ja4h;
EOF

########################################
# nginx.conf
########################################

if [[ ! -f /etc/nginx/nginx.conf ]]; then

cat >/etc/nginx/nginx.conf <<'EOF'
load_module modules/ngx_http_geoip2_module.so;
load_module modules/ngx_stream_geoip2_module.so;
load_module modules/ngx_http_headers_more_filter_module.so;
load_module modules/ngx_http_brotli_filter_module.so;
load_module modules/ngx_http_brotli_static_module.so;

user nginx;

worker_processes auto;
worker_rlimit_nofile 65535;

error_log /var/log/nginx/error.log warn;
pid /run/nginx.pid;

events {
worker_connections 4096;
multi_accept on;
use epoll;
}

stream {
include /etc/nginx/stream.d/*.conf;
}

http {

```
include mime.types;
default_type application/octet-stream;

server_tokens off;
port_in_redirect off;

sendfile on;
tcp_nopush on;
tcp_nodelay on;

keepalive_timeout 65;

types_hash_max_size 2048;
server_names_hash_bucket_size 128;

client_body_buffer_size 128k;
client_header_buffer_size 128k;
client_max_body_size 64m;
large_client_header_buffers 4 128k;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_session_cache builtin:1000 shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling off;
ssl_stapling_verify off;

lua_package_path "/etc/nginx/lua/?.lua;;";
lua_shared_dict cert_cache 50m;

log_format waf
    '$remote_addr '
    '[$time_local] '
    '"$request" '
    '$status '
    '$body_bytes_sent '
    '"$http_referer" '
    '"$http_user_agent" '
    'ja3="$http_ssl_ja3_hash" '
    'ja3_raw="$http_ssl_ja3" '
    'h2fp="$http2_fingerprint" '
    'greased="$http_ssl_greased"';

access_log /var/log/nginx/access.log waf;

brotli on;
brotli_comp_level 5;

brotli_types
    text/plain
    text/css
    text/xml
    application/json
    application/javascript
    application/xml
    image/svg+xml;

gzip on;
gzip_vary on;
gzip_min_length 1024;

gzip_types
    text/plain
    text/css
    application/json
    application/javascript
    application/xml
    text/xml;

include /etc/nginx/conf.d/*.conf;
```

}
EOF

fi

########################################
# SSL Example
########################################

if [[ ! -f /etc/nginx/conf.d/default_ssl.conf ]]; then

cat >/etc/nginx/conf.d/default_ssl.conf <<'EOF'
server {

```
listen 443 ssl;
http2 on;

server_name _;

ssl_certificate     /opt/certs/default/fullchain.pem;
ssl_certificate_key /opt/certs/default/key.pem;

ssl_certificate_by_lua_file /etc/nginx/lua/ssl.lua;

return 444;
```

}
EOF

fi

########################################
# Verify
########################################

echo
echo "======================================="
echo " Verify"
echo "======================================="

nginx -V

echo
nginx -t || true

echo
echo "======================================="
echo " Installed"
echo "======================================="

echo "Binary  : /usr/sbin/nginx"
echo "Config  : /etc/nginx/nginx.conf"
echo "Lua     : /etc/nginx/lua/ssl.lua"
echo "Modules : /usr/lib/nginx/modules"

echo
echo "Start:"
echo "systemctl restart nginx"

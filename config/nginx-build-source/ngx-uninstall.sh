#!/usr/bin/env bash
set -Eeuo pipefail

MODULE_DIR="/usr/lib/nginx/modules"

echo "======================================="
echo " Uninstall Custom NGINX"
echo "======================================="

echo
echo "======================================="
echo " Stop NGINX"
echo "======================================="

systemctl stop nginx >/dev/null 2>&1 || true
systemctl disable nginx >/dev/null 2>&1 || true
pkill nginx >/dev/null 2>&1 || true

echo
echo "======================================="
echo " Remove Binary"
echo "======================================="

rm -f /usr/sbin/nginx

echo
echo "======================================="
echo " Remove Dynamic Modules"
echo "======================================="

rm -f "${MODULE_DIR}/ngx_http_geoip2_module.so"
rm -f "${MODULE_DIR}/ngx_stream_geoip2_module.so"
rm -f "${MODULE_DIR}/ngx_http_headers_more_filter_module.so"
rm -f "${MODULE_DIR}/ngx_http_brotli_filter_module.so"
rm -f "${MODULE_DIR}/ngx_http_brotli_static_module.so"

rmdir "${MODULE_DIR}" 2>/dev/null || true

echo
echo "======================================="
echo " Remove Configuration"
echo "======================================="

rm -rf /etc/nginx

echo
echo "======================================="
echo " Remove Logs"
echo "======================================="

rm -rf /var/log/nginx

echo
echo "======================================="
echo " Remove Cache"
echo "======================================="

rm -rf /var/cache/nginx

echo
echo "======================================="
echo " Remove Certificates"
echo "======================================="

rm -rf /opt/certs

echo
echo "======================================="
echo " Remove Runtime Files"
echo "======================================="

rm -f /run/nginx.pid
rm -f /run/nginx.lock

echo
echo "======================================="
echo " Remove nginx User"
echo "======================================="

userdel nginx >/dev/null 2>&1 || true
groupdel nginx >/dev/null 2>&1 || true

echo
echo "======================================="
echo " Remove Backup Binaries"
echo "======================================="

rm -f /usr/sbin/nginx.backup.*

echo
echo "======================================="
echo " Done"
echo "======================================="

echo
echo "Removed:"
echo "  /usr/sbin/nginx"
echo "  /usr/lib/nginx/modules"
echo "  /etc/nginx"
echo "  /var/log/nginx"
echo "  /var/cache/nginx"
echo "  /opt/certs"
echo "  nginx user/group"
echo "  nginx backup binaries"

echo
echo "Kept:"
echo "  /opt/build"
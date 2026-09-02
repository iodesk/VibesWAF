#!/bin/bash
# VibesWAF Nginx Reload Wrapper
# Owner: root:root, Mode: 0755
# Sudoers: vibeswaf ALL=(root) NOPASSWD: /opt/vibeswaf/scripts/reload-nginx.sh
#
# nginx -s reload fails if /run/nginx.pid is unreadable (read-only mount).
# Bypass: find master PID directly, send HUP.

MASTER_PID=$(pgrep -f "nginx: master" | head -1)

if [ -n "$MASTER_PID" ]; then
    kill -HUP "$MASTER_PID" 2>/dev/null
    exit 0
fi

# Fallback: try nginx -s reload (works if PID file readable)
/usr/sbin/nginx -s reload 2>&1
exit $?

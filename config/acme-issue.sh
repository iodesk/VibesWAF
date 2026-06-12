#!/bin/bash
# Issue an SSL certificate for a domain (as the 'wafer' user).
# acme.sh is installed at /opt/wafer/.acme.sh, so this runs as the wafer user
# to stay consistent with the backend.
# Usage: sudo ./acme-issue.sh example.com

set -e

DOMAIN=$1
ACME_USER="wafer"
ACME_HOME="/opt/wafer"
ACME_SH="$ACME_HOME/.acme.sh/acme.sh"
CERT_DIR="/opt/certs"

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain>"
    exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
    echo "✗ This script must run as root (sudo ./acme-issue.sh <domain>)"
    exit 1
fi

if [ ! -f "$ACME_SH" ]; then
    echo "✗ acme.sh not found at $ACME_SH. Run acme-setup.sh first."
    exit 1
fi

echo "=== Issuing Certificate for $DOMAIN (user: $ACME_USER) ==="
echo ""

# Prepare the domain certificate directory
mkdir -p "$CERT_DIR/$DOMAIN"
chgrp -R cert "$CERT_DIR/$DOMAIN" 2>/dev/null || true
chown "$ACME_USER" "$CERT_DIR/$DOMAIN"

# 1. Issue certificate (standalone mode via ACME challenge port 8080)
echo "[1/2] Issuing certificate..."
sudo -u "$ACME_USER" -H HOME="$ACME_HOME" "$ACME_SH" \
    --issue -d "$DOMAIN" --standalone --httpport 8080

# 2. Install certificate (OpenResty loads certs dynamically via ssl.lua, no reload)
echo "[2/2] Installing certificate..."
sudo -u "$ACME_USER" -H HOME="$ACME_HOME" "$ACME_SH" \
    --install-cert -d "$DOMAIN" \
    --key-file "$CERT_DIR/$DOMAIN/key.pem" \
    --fullchain-file "$CERT_DIR/$DOMAIN/fullchain.pem"

chgrp -R cert "$CERT_DIR/$DOMAIN" 2>/dev/null || true
chmod 640 "$CERT_DIR/$DOMAIN"/*.pem

echo ""
echo "✓ Certificate issued and installed"
echo "  Location: $CERT_DIR/$DOMAIN/"
echo ""
echo "Auto-renewal is enabled (acme.sh installs a cron job for the $ACME_USER user)"
echo ""

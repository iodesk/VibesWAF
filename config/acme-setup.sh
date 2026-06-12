#!/bin/bash
# ACME Setup Script - Install acme.sh as the 'wafer' user for SSL provisioning.
# The wafer backend (systemd User=wafer) is what invokes acme.sh, so acme.sh
# MUST be installed in the wafer user's home (/opt/wafer/.acme.sh), not /root.
# Usage: sudo ./acme-setup.sh

set -e

ACME_EMAIL="${ACME_EMAIL:-admin@domain.com}"
ACME_USER="wafer"
ACME_HOME="/opt/wafer"
CERT_DIR="/opt/certs"

echo "=== ACME.sh Setup (user: $ACME_USER) ==="
echo ""

# Must run as root (needed for sudo -u and chown)
if [ "$(id -u)" -ne 0 ]; then
    echo "✗ This script must run as root (sudo ./acme-setup.sh)"
    exit 1
fi

# The wafer user must exist
if ! id -u "$ACME_USER" > /dev/null 2>&1; then
    echo "✗ User '$ACME_USER' does not exist. Run deploy.sh first."
    exit 1
fi

# 1. Install acme.sh as the wafer user (home = /opt/wafer → /opt/wafer/.acme.sh).
# The installer downloads master.tar.gz into the CWD, so run it from a temp dir
# the wafer user owns. '-H' sets HOME from the wafer account (no manual HOME=).
if [ ! -f "$ACME_HOME/.acme.sh/acme.sh" ]; then
    echo "[1/3] Installing acme.sh as user $ACME_USER..."

    # Make sure the home dir exists and is owned by wafer.
    mkdir -p "$ACME_HOME"
    chown "$ACME_USER":"$ACME_USER" "$ACME_HOME"

    INSTALL_TMP=$(sudo -u "$ACME_USER" mktemp -d)
    sudo -u "$ACME_USER" -H bash -c \
        "cd '$INSTALL_TMP' && curl -fsSL https://get.acme.sh -o install.sh && sh install.sh email=$ACME_EMAIL --home '$ACME_HOME/.acme.sh'"
    rm -rf "$INSTALL_TMP"

    if [ ! -f "$ACME_HOME/.acme.sh/acme.sh" ]; then
        echo "✗ acme.sh install failed (acme.sh not found at $ACME_HOME/.acme.sh)"
        echo "  Check: is $ACME_HOME owned by $ACME_USER, and is curl installed?"
        exit 1
    fi
    echo "✓ acme.sh installed at $ACME_HOME/.acme.sh"
else
    echo "[1/3] acme.sh already installed at $ACME_HOME/.acme.sh"
fi

# 2. Set default CA to Let's Encrypt (as the wafer user)
echo "[2/3] Setting default CA..."
sudo -u "$ACME_USER" -H HOME="$ACME_HOME" \
    "$ACME_HOME/.acme.sh/acme.sh" --set-default-ca --server letsencrypt
echo "✓ Default CA set to Let's Encrypt"

# 3. Prepare certificate directory (group 'cert' so wafer + openresty can access)
echo "[3/3] Preparing certificate directory..."
mkdir -p "$CERT_DIR"
getent group cert > /dev/null 2>&1 || groupadd cert
usermod -aG cert "$ACME_USER"
id -u openresty > /dev/null 2>&1 && usermod -aG cert openresty || true
chgrp -R cert "$CERT_DIR"
chmod -R 2770 "$CERT_DIR"
echo "✓ Certificate directory ready ($CERT_DIR, group cert)"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "acme.sh path (set this in .env ACME_SH_PATH): $ACME_HOME/.acme.sh/acme.sh"
echo ""
echo "Note: OpenResty loads certificates dynamically via ssl.lua (cached with TTL),"
echo "so NO service reload is needed when issuing/renewing certificates."
echo ""
echo "Issue a certificate manually (as the wafer user):"
echo "  sudo -u $ACME_USER -H HOME=$ACME_HOME $ACME_HOME/.acme.sh/acme.sh \\"
echo "    --issue -d example.com --standalone --httpport 8080"
echo ""
echo "Install the certificate:"
echo "  sudo -u $ACME_USER -H HOME=$ACME_HOME $ACME_HOME/.acme.sh/acme.sh \\"
echo "    --install-cert -d example.com \\"
echo "    --key-file $CERT_DIR/example.com/key.pem \\"
echo "    --fullchain-file $CERT_DIR/example.com/fullchain.pem"
echo ""

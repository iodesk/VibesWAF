#!/bin/bash
# Deployment script untuk Vibeswaf WAF
# Usage: ./deploy.sh [production|staging]

set -e

# Resolve project root (one level up from config/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

ENVIRONMENT=${1:-production}
DEPLOY_USER="vibeswaf"
DEPLOY_DIR="/opt/vibeswaf"

echo "=== Vibeswaf WAF Deployment Script ==="
echo "Environment: $ENVIRONMENT"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Build frontend + binary
echo -e "${YELLOW}[1/12] Building frontend...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi


# Production build: API calls use same-origin (no VITE_API_BASE_URL needed)

[ -d "frontend/dist" ] \
    && echo -e "${GREEN}✓ Frontend to frontend/dist${NC}" \
    || { echo -e "${RED}✗ Frontend unkown${NC}"; exit 1; }

echo -e "${YELLOW}   Building Go binary (with embedded frontend)...${NC}"
go build -o vibeswaf .
echo -e "${GREEN}✓ Binary built (BE + FE embedded)${NC}"

# 2. Create user and directories
echo -e "${YELLOW}[2/12] Creating user and directories...${NC}"
if ! id -u $DEPLOY_USER > /dev/null 2>&1; then
    useradd -r -s /bin/bash -d $DEPLOY_DIR $DEPLOY_USER
    echo -e "${GREEN}✓ User $DEPLOY_USER created${NC}"
else
    echo -e "${GREEN}✓ User $DEPLOY_USER already exists${NC}"
fi

mkdir -p $DEPLOY_DIR/{logs,data,migrations,.acme.sh}
mkdir -p /opt/certs/default
mkdir -p /etc/openresty/lua.d
chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_DIR/.acme.sh
echo -e "${GREEN}✓ Directories created${NC}"

# 3. Generate default self-signed SSL certificate (5 years) if not present
echo -e "${YELLOW}[3/12] Generating default self-signed SSL certificate...${NC}"
CERT_DIR="/opt/certs/default"
if [ ! -f "$CERT_DIR/fullchain.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
    openssl req -x509 -nodes -newkey rsa:2048 \
        -keyout "$CERT_DIR/key.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -days 1825 \
        -subj "/CN=default" \
        -addext "subjectAltName=IP:127.0.0.1"
    chown openresty:openresty "$CERT_DIR/fullchain.pem" "$CERT_DIR/key.pem"
    chmod 640 "$CERT_DIR/fullchain.pem" "$CERT_DIR/key.pem"
    echo -e "${GREEN}✓ Self-signed certificate generated (5 years)${NC}"
else
    echo -e "${GREEN}✓ Certificate already exists, skipping${NC}"
fi

# 4. Install acme.sh (skip if already installed)
echo -e "${YELLOW}[4/12] Setting up acme.sh...${NC}"
ACME_EMAIL="${ACME_EMAIL:-admin@domain.com}"
if [ ! -f "$DEPLOY_DIR/.acme.sh/acme.sh" ]; then
    INSTALL_TMP=$(sudo -u "$DEPLOY_USER" mktemp -d)
    sudo -u "$DEPLOY_USER" -H bash -c \
        "cd '$INSTALL_TMP' && curl -fsSL https://get.acme.sh -o install.sh && sh install.sh email=$ACME_EMAIL --home '$DEPLOY_DIR/.acme.sh'"
    rm -rf "$INSTALL_TMP"

    if [ ! -f "$DEPLOY_DIR/.acme.sh/acme.sh" ]; then
        echo -e "${RED}✗ acme.sh install failed${NC}"
        exit 1
    fi

    sudo -u "$DEPLOY_USER" -H HOME="$DEPLOY_DIR" \
        "$DEPLOY_DIR/.acme.sh/acme.sh" --set-default-ca --server letsencrypt

    echo -e "${GREEN}✓ acme.sh installed${NC}"
else
    echo -e "${GREEN}✓ acme.sh already installed, skipping${NC}"
fi

# Ensure ACME_SH_PATH in .env points to the correct install location
if grep -q "^ACME_SH_PATH=" .env; then
    sed -i "s|^ACME_SH_PATH=.*|ACME_SH_PATH=$DEPLOY_DIR/.acme.sh/acme.sh|" .env
else
    echo "ACME_SH_PATH=$DEPLOY_DIR/.acme.sh/acme.sh" >> .env
fi
echo -e "${GREEN}✓ ACME_SH_PATH set to $DEPLOY_DIR/.acme.sh/acme.sh${NC}"
# 5. Stop services
echo -e "${YELLOW}[5/12] Stopping services...${NC}"
systemctl stop vibeswaf || true
echo -e "${GREEN}✓ Services stopped${NC}"

# 6. Backup old version
echo -e "${YELLOW}[6/12] Backing up old version...${NC}"
if [ -f "$DEPLOY_DIR/vibeswaf" ]; then
    cp $DEPLOY_DIR/vibeswaf $DEPLOY_DIR/vibeswaf.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backup created${NC}"
else
    echo -e "${GREEN}✓ No previous version to backup${NC}"
fi

# 7. Copy binary and files
echo -e "${YELLOW}[7/12] Copying files...${NC}"
cp vibeswaf $DEPLOY_DIR/
cp .env $DEPLOY_DIR/
cp -r migrations/* $DEPLOY_DIR/migrations/
cp config/nginx.conf /etc/openresty/nginx.conf
cp config/ssl.lua /etc/openresty/lua.d/ssl.lua

echo -e "${GREEN}✓ Files copied${NC}"

# 8. Set permissions
echo -e "${YELLOW}[8/12] Setting permissions...${NC}"
chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_DIR
chmod +x $DEPLOY_DIR/vibeswaf
chmod 600 $DEPLOY_DIR/.env

chown -R openresty:openresty /etc/openresty
chown -R openresty:openresty /opt/certs
chmod -R 755 /opt/certs

echo -e "${GREEN}✓ Permissions set${NC}"

# 9. Install systemd service
echo -e "${YELLOW}[9/12] Installing systemd service...${NC}"
cp config/vibeswaf.service /etc/systemd/system/vibeswaf.service

# OpenResty needs a raised FD limit to honor worker_rlimit_nofile in nginx.conf.
# Without this the workers hit the default ulimit (1024) → "Too many open files"
# under load. Apply it via a systemd drop-in override.
mkdir -p /etc/systemd/system/openresty.service.d
cat > /etc/systemd/system/openresty.service.d/override.conf <<'EOF'
[Service]
LimitNOFILE=65535
EOF

systemctl daemon-reload
systemctl enable vibeswaf
echo -e "${GREEN}✓ Systemd service installed${NC}"

# 10. Test OpenResty config
echo -e "${YELLOW}[10/12] Testing OpenResty config...${NC}"
openresty -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ OpenResty config valid${NC}"
else
    echo -e "${RED}✗ OpenResty config invalid${NC}"
    exit 1
fi

# 11. Start services
echo -e "${YELLOW}[11/12] Starting services...${NC}"
systemctl start vibeswaf
# restart (not reload) so the LimitNOFILE drop-in takes effect on the workers.
systemctl restart openresty

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:3044/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Backend failed to start${NC}"
        systemctl status vibeswaf
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✓ Services started${NC}"

# 12. Post-deployment checks
echo -e "${YELLOW}[12/12] Post-deployment checks...${NC}"
systemctl is-active --quiet vibeswaf
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Vibeswaf service is running${NC}"
else
    echo -e "${RED}✗ Vibeswaf service is not running${NC}"
    exit 1
fi

systemctl is-active --quiet openresty
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ OpenResty service is running${NC}"
else
    echo -e "${RED}✗ OpenResty service is not running${NC}"
    exit 1
fi

getent group cert > /dev/null 2>&1 || groupadd cert
chgrp -R cert /opt/certs
# vibeswaf (acme.sh) writes certs, openresty reads them — both in the cert group.
# setgid (2) so new files inherit the cert group.
chmod -R 2770 /opt/certs
usermod -aG cert openresty
usermod -aG cert vibeswaf
systemctl restart openresty

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Service status:"
echo "  Vibeswaf:     systemctl status vibeswaf"
echo "  OpenResty: systemctl status openresty"
echo ""
echo "Logs:"
echo "  Vibeswaf:     tail -f $DEPLOY_DIR/logs/app.log"
echo "  OpenResty: tail -f /var/log/openresty/error.log"
echo ""
echo "Health check:"
echo "  curl http://127.0.0.1:3044/health"
echo ""
echo "Issue a certificate:"
echo "  sudo ./config/acme-issue.sh example.com"
echo ""

#!/bin/bash
# Deployment script untuk Wafer WAF
# Usage: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
DEPLOY_USER="wafer"
DEPLOY_DIR="/opt/wafer"

echo "=== Wafer WAF Deployment Script ==="
echo "Environment: $ENVIRONMENT"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Pre-deployment checks
echo -e "${YELLOW}[1/10] Pre-deployment checks...${NC}"
if [ ! -f "wafer" ]; then
    echo -e "${RED}✗ Binary 'wafer' not found. Build first: go build -o wafer${NC}"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo -e "${RED}✗ .env file not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"

# 2. Create user and directories
echo -e "${YELLOW}[2/10] Creating user and directories...${NC}"
if ! id -u $DEPLOY_USER > /dev/null 2>&1; then
    useradd -r -s /bin/bash -d $DEPLOY_DIR $DEPLOY_USER
    echo -e "${GREEN}✓ User $DEPLOY_USER created${NC}"
else
    echo -e "${GREEN}✓ User $DEPLOY_USER already exists${NC}"
fi

mkdir -p $DEPLOY_DIR/{logs,data,migrations}
mkdir -p /opt/certs/default
mkdir -p /etc/openresty/lua.d

# 3. Stop services
echo -e "${YELLOW}[3/10] Stopping services...${NC}"
systemctl stop wafer || true
echo -e "${GREEN}✓ Services stopped${NC}"

# 4. Backup old version
echo -e "${YELLOW}[4/10] Backing up old version...${NC}"
if [ -f "$DEPLOY_DIR/wafer" ]; then
    cp $DEPLOY_DIR/wafer $DEPLOY_DIR/wafer.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✓ Backup created${NC}"
else
    echo -e "${GREEN}✓ No previous version to backup${NC}"
fi

# 5. Copy binary and files
echo -e "${YELLOW}[5/10] Copying files...${NC}"
cp wafer $DEPLOY_DIR/
cp .env $DEPLOY_DIR/
cp -r migrations/* $DEPLOY_DIR/migrations/
cp config/nginx.conf /etc/openresty/nginx.conf
cp config/ssl.lua /etc/openresty/lua.d/ssl.lua

echo -e "${GREEN}✓ Files copied${NC}"

# 6. Set permissions
echo -e "${YELLOW}[6/10] Setting permissions...${NC}"
chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_DIR
chmod +x $DEPLOY_DIR/wafer
chmod 600 $DEPLOY_DIR/.env

chown -R openresty:openresty /etc/openresty
chown -R openresty:openresty /opt/certs
chmod -R 755 /opt/certs

echo -e "${GREEN}✓ Permissions set${NC}"

# 7. Install systemd service
echo -e "${YELLOW}[7/10] Installing systemd service...${NC}"
cp config/wafer.service /etc/systemd/system/wafer.service

# OpenResty needs a raised FD limit to honor worker_rlimit_nofile in nginx.conf.
# Without this the workers hit the default ulimit (1024) → "Too many open files"
# under load. Apply it via a systemd drop-in override.
mkdir -p /etc/systemd/system/openresty.service.d
cat > /etc/systemd/system/openresty.service.d/override.conf <<'EOF'
[Service]
LimitNOFILE=65535
EOF

systemctl daemon-reload
systemctl enable wafer
echo -e "${GREEN}✓ Systemd service installed${NC}"

# 8. Test OpenResty config
echo -e "${YELLOW}[8/10] Testing OpenResty config...${NC}"
openresty -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ OpenResty config valid${NC}"
else
    echo -e "${RED}✗ OpenResty config invalid${NC}"
    exit 1
fi

# 9. Start services
echo -e "${YELLOW}[9/10] Starting services...${NC}"
systemctl start wafer
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
        systemctl status wafer
        exit 1
    fi
    sleep 1
done

echo -e "${GREEN}✓ Services started${NC}"

# 10. Post-deployment checks
echo -e "${YELLOW}[10/10] Post-deployment checks...${NC}"
systemctl is-active --quiet wafer
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Wafer service is running${NC}"
else
    echo -e "${RED}✗ Wafer service is not running${NC}"
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
# wafer (acme.sh) writes certs, openresty reads them — both in the cert group.
# setgid (2) so new files inherit the cert group.
chmod -R 2770 /opt/certs
usermod -aG cert openresty
usermod -aG cert wafer
systemctl restart openresty

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Service status:"
echo "  Wafer:     systemctl status wafer"
echo "  OpenResty: systemctl status openresty"
echo ""
echo "Logs:"
echo "  Wafer:     tail -f $DEPLOY_DIR/logs/app.log"
echo "  OpenResty: tail -f /var/log/openresty/error.log"
echo ""
echo "Health check:"
echo "  curl http://127.0.0.1:3044/health"
echo ""

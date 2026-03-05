#!/bin/bash
set -euo pipefail

# =============================================================================
# Bizware Power BI Dashboards - VPS Deployment Script
# Target: srv1368855.hstgr.cloud (Hostinger)
# =============================================================================

DOMAIN="srv1368855.hstgr.cloud"
PROJECT_DIR="/opt/bizware-dashboards"

echo "============================================"
echo " Bizware Dashboards - VPS Deployment"
echo "============================================"

# 1. System update
echo "[1/7] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw apt-transport-https ca-certificates software-properties-common

# 2. Install Docker
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"

# 3. Firewall
echo "[3/7] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
echo "y" | ufw enable
ufw status

# 4. Project setup
echo "[4/7] Setting up project directory..."
mkdir -p ${PROJECT_DIR}

if [ -d "${PROJECT_DIR}/.git" ]; then
    echo "Project exists, pulling latest..."
    cd ${PROJECT_DIR} && git pull
else
    echo "Copy your project files to ${PROJECT_DIR}"
    echo "Example: scp -r ./* root@${DOMAIN}:${PROJECT_DIR}/"
fi

cd ${PROJECT_DIR}

# 5. Environment setup
echo "[5/7] Checking environment file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "IMPORTANT: Edit .env with production values!"
    echo "  nano ${PROJECT_DIR}/.env"
    echo ""
    echo "Required changes:"
    echo "  - POSTGRES_PASSWORD (strong random password)"
    echo "  - N8N_PASSWORD (strong random password)"
    echo "  - POWERBI_EMBED_URL (after Power BI publish)"
    echo "  - SSL_EMAIL (your email for Let's Encrypt)"
    echo ""
    read -p "Press Enter after editing .env..."
fi

# 6. SSL Setup
echo "[6/7] Setting up SSL..."
bash ./scripts/setup-ssl.sh

# 7. Launch services
echo "[7/7] Starting services..."
docker compose up -d --build

echo ""
echo "============================================"
echo " Deployment Complete!"
echo "============================================"
echo ""
echo "Services:"
echo "  Frontend:  https://${DOMAIN}"
echo "  API:       https://${DOMAIN}/api/health"
echo "  n8n:       https://${DOMAIN}/n8n/"
echo ""
echo "Verify with: docker compose ps"
echo "View logs:   docker compose logs -f"

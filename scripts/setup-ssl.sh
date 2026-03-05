#!/bin/bash
set -euo pipefail

# =============================================================================
# SSL Setup via Let's Encrypt (Certbot)
# =============================================================================

DOMAIN="srv1368855.hstgr.cloud"
EMAIL="${SSL_EMAIL:-admin@example.com}"

echo "Setting up SSL for ${DOMAIN}..."

# Create temporary nginx config for initial cert
mkdir -p /tmp/nginx-init

cat > /tmp/nginx-init/default.conf << 'INITCONF'
server {
    listen 80;
    server_name srv1368855.hstgr.cloud;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Waiting for SSL setup...';
        add_header Content-Type text/plain;
    }
}
INITCONF

# Start nginx temporarily for cert validation
docker compose up -d nginx

# Wait for nginx
sleep 5

# Request certificate
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}"

# Restart nginx with full SSL config
docker compose restart nginx

echo "SSL certificate obtained for ${DOMAIN}"
echo "Auto-renewal is handled by the certbot container."

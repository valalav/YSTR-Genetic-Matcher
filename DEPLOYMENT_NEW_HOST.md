# YSTR Matcher - Deployment Guide for New Hosting

> **Last Updated**: 2025-10-14
> **Target**: Production-ready deployment on new hosting provider
> **Estimated Time**: 2-4 hours (depending on infrastructure)

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Server Setup](#step-1-server-setup)
4. [Step 2: Network Configuration](#step-2-network-configuration)
5. [Step 3: Application Deployment](#step-3-application-deployment)
6. [Step 4: Database Setup](#step-4-database-setup)
7. [Step 5: Nginx Reverse Proxy](#step-5-nginx-reverse-proxy)
8. [Step 6: SSL Certificates](#step-6-ssl-certificates)
9. [Step 7: Testing & Verification](#step-7-testing--verification)
10. [Troubleshooting](#troubleshooting)
11. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Prerequisites

### Hardware Requirements

**Minimum** (Development/Testing):
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Network**: 100 Mbps

**Recommended** (Production):
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 100GB+ SSD
- **Network**: 1 Gbps
- **Backup**: Weekly automated backups

### Software Requirements

- **OS**: Ubuntu 22.04 LTS or Debian 11+ (recommended)
- **Node.js**: v18.x or v20.x LTS
- **PostgreSQL**: 14+ (with JSONB support)
- **Redis**: 6.x or 7.x
- **Nginx**: 1.18+ (or Docker with nginx image)
- **PM2**: Latest (for process management)
- **Git**: For cloning repository

### Domain & DNS

- **Production domain** (e.g., `ystr.example.com`)
- **Development domain** (optional, e.g., `dev.ystr.example.com`)
- **DNS A records** pointing to your server IP
- **Email** for Let's Encrypt SSL notifications

---

## Architecture Overview

```
Internet
    │
    ├─► VPS/Server (Public IP)
    │   ├─ Nginx Reverse Proxy (ports 80/443)
    │   │   ├─► Next.js Frontend (:9002)
    │   │   ├─► FTDNA Haplo API (:9003)
    │   │   └─► Backend PostgreSQL API (:9004)
    │   │
    │   ├─ Certbot (SSL/TLS certificates)
    │   ├─ PostgreSQL Database (ystr_matcher)
    │   ├─ Redis (caching & job queue)
    │   └─ PM2 Process Manager
```

**Key Components**:
1. **Next.js Frontend** (Port 9002): User interface with IndexedDB storage
2. **FTDNA Haplo API** (Port 9003): Haplogroup validation service
3. **Backend API** (Port 9004): PostgreSQL database operations, API keys, caching
4. **Nginx**: Reverse proxy with SSL termination
5. **PostgreSQL**: 313,932+ Y-STR profiles storage
6. **Redis**: Results caching, API rate limiting

---

## Step 1: Server Setup

### 1.1. Update System

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential software-properties-common
```

### 1.2. Install Node.js

```bash
# Add NodeSource repository (Node.js 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x
npm --version   # Should be 10.x
```

### 1.3. Install PostgreSQL

```bash
# Install PostgreSQL 14+
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo -u postgres psql --version
```

### 1.4. Install Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping  # Should return "PONG"
```

### 1.5. Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 to start on boot
pm2 startup
# Follow the command it provides (run as root)

# Verify installation
pm2 --version
```

---

## Step 2: Network Configuration

### 2.1. Firewall Setup

```bash
# Install UFW (if not already installed)
sudo apt install -y ufw

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify status
sudo ufw status
```

### 2.2. DNS Configuration

**Required DNS Records**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | ystr.example.com | YOUR_SERVER_IP | 3600 |
| A | dev.ystr.example.com | YOUR_SERVER_IP | 3600 |

**Verification**:
```bash
# Wait for DNS propagation (5-30 minutes)
dig ystr.example.com +short  # Should return your server IP
```

---

## Step 3: Application Deployment

### 3.1. Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/ystr-matcher
sudo chown $USER:$USER /opt/ystr-matcher

# Clone repository
cd /opt/ystr-matcher
git clone https://github.com/valalav/YSTR-Genetic-Matcher.git .

# Or if using SSH:
# git clone git@github.com:valalav/YSTR-Genetic-Matcher.git .
```

### 3.2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install Next.js frontend dependencies
cd str-matcher
npm install
cd ..

# Install backend dependencies
cd backend
npm install
cd ..

# Install FTDNA Haplo API dependencies
cd ftdna_haplo/server
npm install
cd ../..
```

### 3.3. Build Next.js

```bash
cd str-matcher
npm run build
cd ..
```

### 3.4. Configure Backend Environment

```bash
cd backend

# Copy .env.example to .env
cp .env.example .env

# Edit .env file
nano .env  # or vim, or any text editor
```

**Update the following variables** in `backend/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ystr_matcher
DB_USER=postgres
DB_PASSWORD=YOUR_SECURE_POSTGRES_PASSWORD

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=9004
NODE_ENV=production
ALLOWED_ORIGINS=https://ystr.example.com,https://dev.ystr.example.com

# Master API Key (CRITICAL - Generate new one!)
# Generate with: node -e "console.log('master_' + require('crypto').randomBytes(32).toString('hex'))"
MASTER_API_KEY=master_YOUR_64_CHARACTER_HEX_KEY_HERE

# Security
JWT_SECRET=YOUR_RANDOM_JWT_SECRET_HERE
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
TRUST_PROXY=true
```

**Generate Master API Key**:
```bash
node -e "console.log('master_' + require('crypto').randomBytes(32).toString('hex'))"
# Copy the output and paste into MASTER_API_KEY in .env
# IMPORTANT: Save this key securely - you'll need it for admin access!
```

---

## Step 4: Database Setup

### 4.1. Create Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE ystr_matcher;
CREATE USER ystr_user WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE ystr_matcher TO ystr_user;
\q
```

### 4.2. Import Schema

```bash
cd /opt/ystr-matcher

# Import main schema
sudo -u postgres psql -d ystr_matcher -f database/schema.sql

# Import optimized matching function
sudo -u postgres psql -d ystr_matcher -f database/optimized-v5-marker-panel-filter.sql

# Import API keys and audit tables
sudo -u postgres psql -d ystr_matcher -f database/api-keys-and-audit.sql
```

### 4.3. Import Y-STR Profiles Data

**Option A: From CSV dump** (if you have a backup):
```bash
cd backend
node scripts/import-csv-to-postgres.js /path/to/ystr_profiles.csv
```

**Option B: From existing PostgreSQL dump**:
```bash
# If you have a .sql dump file
sudo -u postgres psql -d ystr_matcher < /path/to/profiles_dump.sql
```

### 4.4. Verify Database

```bash
sudo -u postgres psql -d ystr_matcher

# Check tables
\dt

# Check profiles count
SELECT COUNT(*) FROM ystr_profiles;
# Should return 313,932+ rows if data imported

# Check API keys table
SELECT COUNT(*) FROM api_keys;

\q
```

---

## Step 5: Nginx Reverse Proxy

### 5.1. Install Nginx with Docker (Recommended)

```bash
# Create nginx-proxy directory
mkdir -p ~/nginx-proxy
cd ~/nginx-proxy
```

**Create `docker-compose.yml`**:
```yaml
version: '3.8'

services:
  nginx:
    image: nginx:latest
    container_name: ystr-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/templates:/etc/nginx/templates:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./logs:/var/log/nginx
    restart: unless-stopped
    networks:
      - ystr-network

  certbot:
    image: certbot/certbot:latest
    container_name: ystr-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    networks:
      - ystr-network

networks:
  ystr-network:
    driver: bridge
```

**Start nginx**:
```bash
# Create required directories
mkdir -p nginx/conf.d nginx/templates certbot/conf certbot/www logs

# Start services
docker-compose up -d

# Verify
docker-compose ps
```

### 5.2. Configure Nginx with Templates

```bash
cd ~/nginx-proxy

# Copy .env.example to .env (if not exists in repo, create manually)
nano .env
```

**Edit `.env` file**:
```env
# Production Environment
PROD_DOMAIN=ystr.example.com
PROD_CONTAINER_IP=127.0.0.1  # or your server's IP
PROD_NEXTJS_PORT=9002
PROD_FTDNA_HAPLO_PORT=9003
PROD_BACKEND_API_PORT=9004

# Development Environment
DEV_DOMAIN=dev.ystr.example.com
DEV_CONTAINER_IP=127.0.0.1
DEV_NEXTJS_PORT=9002
DEV_FTDNA_HAPLO_PORT=9003
DEV_BACKEND_API_PORT=9004

# SSL Configuration
SSL_EMAIL=your-email@example.com
SSL_CERT_PATH=/etc/letsencrypt/live
SSL_OPTIONS=/etc/letsencrypt/options-ssl-nginx.conf
SSL_DHPARAMS=/etc/letsencrypt/ssl-dhparams.pem

# Proxy Settings
PROXY_CONNECT_TIMEOUT=60
PROXY_SEND_TIMEOUT=60
PROXY_READ_TIMEOUT=60
CLIENT_MAX_BODY_SIZE=50M
```

**Copy templates from repository**:
```bash
# Templates should be in the repo at nginx/templates/
# If not, they need to be created with proper ${VARIABLE} placeholders

# Generate nginx configs from templates
./generate-configs.sh

# Verify generated configs
ls -la nginx/conf.d/
```

---

## Step 6: SSL Certificates

### 6.1. Obtain SSL Certificates

**For production domain**:
```bash
cd ~/nginx-proxy

docker-compose exec certbot certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d ystr.example.com
```

**For development domain**:
```bash
docker-compose exec certbot certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d dev.ystr.example.com
```

### 6.2. Regenerate Nginx Configs with SSL

```bash
# Regenerate configs (now with SSL certificates available)
./generate-configs.sh --reload

# Verify nginx configuration
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose exec nginx nginx -s reload
```

---

## Step 7: Start Application Services

### 7.1. Configure PM2 Ecosystem

```bash
cd /opt/ystr-matcher

# ecosystem.config.js should already exist
# Verify it has correct paths
cat ecosystem.config.js
```

**Expected `ecosystem.config.js`**:
```javascript
module.exports = {
  apps: [
    {
      name: "ftdna-haplo-app",
      script: "./ftdna_haplo/server/server.js",
      cwd: "/opt/ystr-matcher",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 9003
      }
    },
    {
      name: "str-matcher-app",
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 9002",
      cwd: "/opt/ystr-matcher/str-matcher",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 9002
      }
    },
    {
      name: "backend-api-server",
      script: "./backend/server.js",
      cwd: "/opt/ystr-matcher",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 9004
      }
    }
  ]
};
```

### 7.2. Start Services with PM2

```bash
cd /opt/ystr-matcher

# Start all services
pm2 start ecosystem.config.js --env production

# Check status
pm2 list

# Expected output:
# ┌─────┬───────────────────────┬─────────┬─────────┬─────────┐
# │ id  │ name                  │ status  │ restart │ uptime  │
# ├─────┼───────────────────────┼─────────┼─────────┼─────────┤
# │ 0   │ ftdna-haplo-app       │ online  │ 0       │ 10s     │
# │ 1   │ str-matcher-app       │ online  │ 0       │ 10s     │
# │ 2   │ backend-api-server    │ online  │ 0       │ 10s     │
# └─────┴───────────────────────┴─────────┴─────────┴─────────┘

# Save PM2 configuration
pm2 save

# Setup PM2 startup script (if not done earlier)
pm2 startup
# Follow the command it provides
```

### 7.3. Verify Services

```bash
# Check if services are listening on correct ports
ss -tlnp | grep -E "900[234]"

# Expected output:
# LISTEN  0  511  *:9002  *:*  users:(("node",pid=XXXX))  # Next.js
# LISTEN  0  511  *:9003  *:*  users:(("node",pid=XXXX))  # FTDNA Haplo
# LISTEN  0  511  *:9004  *:*  users:(("node",pid=XXXX))  # Backend API

# View logs
pm2 logs
pm2 logs ftdna-haplo-app
pm2 logs str-matcher-app
pm2 logs backend-api-server
```

---

## Step 8: Testing & Verification

### 8.1. Health Checks

**Local health checks**:
```bash
# Test Next.js
curl -I http://localhost:9002
# Expected: HTTP/1.1 200 OK

# Test FTDNA Haplo API
curl -I http://localhost:9003/health
# Expected: HTTP/1.1 200 OK

# Test Backend API
curl -I http://localhost:9004/health
# Expected: HTTP/1.1 200 OK
```

**Public HTTPS health checks**:
```bash
# Test production domain
curl -I https://ystr.example.com
# Expected: HTTP/2 200

# Test Backend API through nginx
curl -I https://ystr.example.com/api/profiles/
# Expected: HTTP/2 200

# Test FTDNA Haplo API through nginx
curl -I https://ystr.example.com/api/check-subclade
# Expected: HTTP/2 200
```

### 8.2. Functional Tests

**Test API Key validation**:
```bash
curl -X POST https://ystr.example.com/api/samples/validate-key \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_MASTER_API_KEY"

# Expected: {"success": true, "message": "API key is valid"}
```

**Test database query**:
```bash
curl https://ystr.example.com/api/profiles/stats/database

# Expected: JSON with profile counts and statistics
```

**Test search functionality**:
```bash
curl "https://ystr.example.com/api/samples/?search=test&limit=5"

# Expected: JSON with search results
```

### 8.3. Browser Testing

1. Open `https://ystr.example.com` in browser
2. Check for SSL/TLS certificate (should be valid, green padlock)
3. Navigate to `/samples` page
4. Try logging in with Master API Key
5. Test creating/editing a sample
6. Check browser console for errors (should be none)

---

## Step 9: Monitoring & Maintenance

### 9.1. Setup Log Rotation

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/ystr-matcher
```

**Content**:
```
/opt/ystr-matcher/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 9.2. Setup Automated Backups

**Database backup script** (`/opt/ystr-matcher/scripts/backup-db.sh`):
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/ystr-matcher"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
sudo -u postgres pg_dump ystr_matcher | gzip > $BACKUP_DIR/db_${DATE}.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: db_${DATE}.sql.gz"
```

**Setup cron job**:
```bash
# Make script executable
chmod +x /opt/ystr-matcher/scripts/backup-db.sh

# Add to crontab
crontab -e

# Add this line (daily backup at 2 AM)
0 2 * * * /opt/ystr-matcher/scripts/backup-db.sh >> /var/log/ystr-backup.log 2>&1
```

### 9.3. Monitoring with PM2

```bash
# Install PM2 monitoring module (optional)
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# Setup web dashboard (optional)
pm2 web
# Access at http://your-server-ip:9615
```

---

## Troubleshooting

### Issue 1: Services Not Starting

**Symptoms**: `pm2 list` shows services in "errored" or "stopped" state

**Solutions**:
```bash
# Check logs
pm2 logs --lines 50

# Common causes:
# 1. Port already in use
lsof -i :9002
lsof -i :9003
lsof -i :9004
# Kill conflicting process or change port

# 2. Missing dependencies
cd /opt/ystr-matcher/backend
npm install
cd ../str-matcher
npm install

# 3. Database connection issue
# Check backend/.env has correct DB credentials
# Test PostgreSQL connection:
psql -h localhost -U ystr_user -d ystr_matcher
```

### Issue 2: 502 Bad Gateway

**Symptoms**: Nginx returns 502 error

**Solutions**:
```bash
# Check if services are running
pm2 list

# Check if services are listening
ss -tlnp | grep -E "900[234]"

# Check nginx error logs
docker-compose logs nginx | tail -50

# Verify nginx config
docker-compose exec nginx nginx -t

# Test local endpoints
curl http://localhost:9002
curl http://localhost:9003
curl http://localhost:9004
```

### Issue 3: SSL Certificate Issues

**Symptoms**: Browser shows SSL error

**Solutions**:
```bash
# Verify certificates exist
ls -la ~/nginx-proxy/certbot/conf/live/ystr.example.com/

# If missing, obtain certificates again (see Step 6)

# Check nginx SSL config
docker-compose exec nginx cat /etc/nginx/conf.d/ystr.example.com.conf | grep ssl_certificate

# Test SSL
openssl s_client -connect ystr.example.com:443
```

### Issue 4: Database Query Performance

**Symptoms**: Slow API responses, timeout errors

**Solutions**:
```bash
# Check database size
sudo -u postgres psql -d ystr_matcher -c "SELECT pg_size_pretty(pg_database_size('ystr_matcher'));"

# Check slow queries
sudo -u postgres psql -d ystr_matcher -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Vacuum database
sudo -u postgres psql -d ystr_matcher -c "VACUUM ANALYZE;"

# Check Redis cache
redis-cli INFO stats
redis-cli DBSIZE
```

---

## Post-Deployment Checklist

- [ ] All 3 PM2 services running (ftdna-haplo-app, str-matcher-app, backend-api-server)
- [ ] All ports accessible (9002, 9003, 9004)
- [ ] Nginx reverse proxy working (HTTPS 200 on all endpoints)
- [ ] SSL certificates valid (green padlock in browser)
- [ ] Database accessible (ystr_profiles table has data)
- [ ] Redis caching working
- [ ] Master API Key generated and saved securely
- [ ] Sample Manager UI accessible at `/samples`
- [ ] Admin UI accessible at `/admin`
- [ ] CORS configured correctly (ALLOWED_ORIGINS in backend/.env)
- [ ] Automated backups configured (cron job)
- [ ] Log rotation configured
- [ ] Firewall rules applied (UFW)
- [ ] PM2 startup script configured
- [ ] Documentation updated with actual domain names and IPs
- [ ] Team members have access credentials

---

## Security Recommendations

1. **Change Default Passwords**:
   - PostgreSQL password
   - Redis password (if authentication enabled)
   - Master API Key

2. **Restrict Database Access**:
   ```bash
   # Edit PostgreSQL config
   sudo nano /etc/postgresql/14/main/pg_hba.conf
   # Restrict to localhost only
   ```

3. **Enable Fail2ban**:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

4. **Regular Updates**:
   ```bash
   # Weekly security updates
   sudo apt update && sudo apt upgrade -y

   # Update Node.js dependencies
   cd /opt/ystr-matcher
   npm audit fix
   ```

5. **Monitor Logs**:
   ```bash
   # Check for suspicious activity
   pm2 logs | grep -i error
   docker-compose logs nginx | grep -i "502\|500"
   ```

---

## Support & Resources

- **GitHub Repository**: https://github.com/valalav/YSTR-Genetic-Matcher
- **Documentation**: `/opt/ystr-matcher/CLAUDE.md`
- **Issue Tracker**: GitHub Issues
- **API Documentation**: See `backend/routes/` for endpoint details

---

**Deployment completed successfully?** 🎉

Remember to:
1. Save Master API Key in password manager
2. Document your specific IP addresses and domains
3. Setup monitoring alerts
4. Schedule regular backups
5. Keep dependencies updated

**Need help?** Open an issue on GitHub with:
- OS and version (`uname -a`)
- Node.js version (`node --version`)
- Error logs (`pm2 logs`, `docker-compose logs`)
- Steps to reproduce

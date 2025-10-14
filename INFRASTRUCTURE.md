# YSTR Genetic Matcher - Infrastructure Documentation

Last Updated: $(date -Iseconds)

---

## Server Architecture

### Production Environment (Container 109)
- **Domain:** bpystr.valalav.ru
- **IP:** 192.168.10.170
- **OS:** Ubuntu 24.04 LTS (in Proxmox LXC container)
- **Purpose:** Production deployment, accessible via domain

**Services:**
- Frontend (Next.js): Port 3000
- Backend (Express): Port 9005  
- FTDNA Haplo Server: Port 9003
- PostgreSQL: Port 5432 (Docker: ystr-postgres)
- Redis: Port 6379 (Docker: ystr-redis)

**Service Management:**
```bash
systemctl status str-matcher.service    # Frontend
systemctl status ystr-backend.service   # Backend
systemctl status ftdna-haplo.service    # Haplogroup API
docker ps                               # PostgreSQL & Redis
```

**Logs:**
- Frontend: `/var/log/str-matcher.log`
- Backend: `/var/log/backend.log`
- System: `journalctl -u str-matcher.service`

### Development Environment (Container 112)
- **Domain:** dev.bpystr.valalav.ru (or similar)
- **Purpose:** Development and testing
- **Configuration:** Same as production but with separate database

**Key Differences:**
- Git repository is the working copy
- Changes are committed here before pushing to GitHub
- Can run in development mode with hot reload

---

## Application Stack

### Frontend (Next.js 15.1.4)
- **Framework:** Next.js with App Router
- **UI:** React 18 + Redux Toolkit
- **Styling:** Tailwind CSS + Radix UI
- **Build:** Turbopack (dev), optimized build (production)
- **Features:**
  - Server-side rendering (SSR)
  - API route proxying to backend
  - IndexedDB for local profile storage
  - Web Workers for heavy computations

### Backend (Node.js/Express)
- **Runtime:** Node.js 20.x with 8GB heap (`--max-old-space-size=8192`)
- **Framework:** Express.js
- **Database:** PostgreSQL 15 with JSONB
- **Cache:** Redis 7
- **Features:**
  - RESTful API
  - Rate limiting (100 req/15min)
  - CORS configured for frontend
  - API key authentication
  - Batch processing for large CSV uploads

### FTDNA Haplogroup Server
- **Port:** 9003
- **Purpose:** Haplogroup tree operations
- **Endpoints:**
  - `/api/haplogroup-path/:path*`
  - `/api/check-subclade`
  - `/api/search/:haplogroup`
  - `/api/autocomplete`

### Database (PostgreSQL)
- **Version:** 15
- **Container:** ystr-postgres (Docker)
- **Schema:**
  - `ystr_profiles` - Main profiles table with JSONB markers
  - `api_keys` - API key authentication
  - `audit_log` - Activity tracking
- **Functions:**
  - `find_matches_batch()` - Core matching algorithm
- **Size:** ~313,932 profiles (~several GB)

### Cache (Redis)
- **Version:** 7
- **Container:** ystr-redis (Docker)
- **Usage:**
  - Query result caching (1 hour TTL)
  - Profile caching (24 hours TTL)
  - Job queue for async operations

---

## Network Architecture

```
Internet
    ↓
[bpystr.valalav.ru] (Production - Container 109)
    ↓
192.168.10.170:3000 → Next.js Frontend
    ↓ (proxies to)
    ├→ localhost:9005 → Backend API (PostgreSQL)
    └→ localhost:9003 → FTDNA Haplo API

[dev.bpystr.valalav.ru] (Dev - Container 112)
    ↓
(Same architecture, separate containers)
```

**Reverse Proxy Configuration:**
- Next.js handles API routing via `rewrites()` in `next.config.js`
- Backend requires `trust proxy: true` for proper client IP detection
- CORS whitelist includes localhost:3000-3003 and 192.168.10.170:3000-3003

---

## Deployment Workflow

### 1. Development (Container 112)
```bash
cd /root/dna-utils/str-matcher
npm run dev              # Hot reload on port 3000

cd /root/dna-utils/backend  
npm run dev              # Nodemon auto-restart
```

### 2. Git Workflow
```bash
# Make changes in container 112
cd /root/dna-utils
git add .
git commit -m "Description of changes"
git push origin main
```

### 3. GitHub Actions (Automated)
- **Trigger:** Push to main branch
- **Actions:**
  - Run tests
  - Build frontend
  - Export SQL database dump
  - Store as artifact

### 4. Production Deployment (Container 109)
```bash
# Pull latest changes
cd /root/dna-utils
git pull origin main

# Restart services if needed
systemctl restart str-matcher.service
systemctl restart ystr-backend.service

# Or use PM2/systemd
npm run build            # Frontend
systemctl restart ...    # Services
```

---

## Database Synchronization

### Export from Production (Container 109)
```bash
docker exec ystr-postgres pg_dump -U postgres ystr_matcher > /tmp/production.sql
```

### Import to Development (Container 112)
```bash
docker exec -i ystr-postgres psql -U postgres ystr_matcher < /tmp/production.sql
```

### Via GitHub Actions
- SQL dump is exported on every push
- Download artifact from GitHub Actions
- Import into dev database

---

## Backup Strategy

### Database Backups
```bash
# Automated daily backup (cron)
0 2 * * * docker exec ystr-postgres pg_dump -U postgres ystr_matcher | gzip > /backup/ystr_$(date +\%Y\%m\%d).sql.gz
```

### Code Backups
- Git repository on GitHub: https://github.com/valalav/YSTR-Genetic-Matcher
- Local copies in both containers
- GitHub commit history

### Configuration Backups
- `.env` files (not in Git)
- Service configurations in `/etc/systemd/system/`
- KEYS.md (not in Git)

---

## Monitoring

### Health Checks
```bash
# Frontend
curl http://localhost:3000/

# Backend
curl http://localhost:9005/health

# Database
docker exec ystr-postgres psql -U postgres -c "SELECT version();"

# Redis
docker exec ystr-redis redis-cli PING
```

### Logs
```bash
# Real-time logs
tail -f /var/log/str-matcher.log
tail -f /var/log/backend.log

# Service logs
journalctl -u str-matcher.service -f
journalctl -u ystr-backend.service -f

# Docker logs
docker logs ystr-postgres
docker logs ystr-redis
```

### Performance Metrics
- CPU: `htop` or `top`
- Memory: `free -h`
- Disk: `df -h`
- Network: `ss -tulpn`

---

## Troubleshooting

### Common Issues

**1. Port Already in Use (EADDRINUSE)**
```bash
# Find process using port
ss -tulpn | grep :3000
kill <PID>
systemctl restart str-matcher.service
```

**2. CORS Errors**
- Check `CORS_ORIGIN` in backend `.env`
- Verify `trust proxy: true` in backend/server.js
- Check Next.js rewrites in `next.config.js`

**3. Database Connection Errors**
```bash
# Check PostgreSQL is running
docker ps | grep ystr-postgres

# Check credentials
docker exec -it ystr-postgres psql -U postgres -d ystr_matcher
```

**4. Out of Memory**
- Backend requires `--max-old-space-size=8192` for large datasets
- Check memory usage: `free -h`
- Restart services to clear memory leaks

**5. Slow Queries**
- Check Redis cache: `docker exec ystr-redis redis-cli INFO`
- Clear cache: `docker exec ystr-redis redis-cli FLUSHALL`
- Check PostgreSQL indexes: `EXPLAIN ANALYZE` queries

---

## Security Considerations

1. **API Keys:**
   - Master key grants full access
   - Regular keys limited to specific operations
   - Keys stored as SHA-256 hashes in database

2. **Rate Limiting:**
   - 100 requests per 15 minutes per IP
   - Slow down after 50 requests

3. **CORS:**
   - Whitelist specific origins
   - No wildcard (*) in production

4. **Database:**
   - No direct public access
   - Backend acts as gateway
   - Parameterized queries prevent SQL injection

5. **File Uploads:**
   - 500MB max size
   - CSV validation
   - Malware scanning (TODO)

---

## Performance Tuning

### Frontend
- Code splitting with Next.js
- Web Workers for CPU-intensive tasks
- IndexedDB for large datasets
- Virtual scrolling for tables

### Backend
- Redis caching (1 hour TTL)
- Batch processing (5000 profiles/batch)
- Connection pooling (20 connections)
- Compression middleware

### Database
- Indexes on `kit_number`, `haplogroup`
- JSONB for flexible marker storage
- Materialized views for statistics
- Vacuum and analyze regularly

---

## Future Improvements

1. **High Availability:**
   - Load balancer for multiple backend instances
   - PostgreSQL replication
   - Redis cluster

2. **Monitoring:**
   - Prometheus + Grafana
   - Error tracking (Sentry)
   - Uptime monitoring

3. **CI/CD:**
   - Automated testing
   - Staging environment
   - Blue-green deployments

4. **Security:**
   - HTTPS/TLS certificates
   - Web Application Firewall (WAF)
   - Regular security audits

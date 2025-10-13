# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**YSTR Matcher v2.0** - High-performance Y-chromosome STR (Short Tandem Repeat) genetic matching system designed to compare and analyze 100,000-200,000+ DNA profiles. The system uses PostgreSQL with optimized SQL functions, Redis caching, and optional CUDA-accelerated ML haplogroup prediction.

## Architecture

The system is a **monorepo** containing three main services:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   CUDA Service  │
│   (Next.js)     │◄──►│   (Express)     │◄──►│   (FastAPI)     │
│   str-matcher/  │    │   backend/      │    │   cuda-predictor│
│                 │    │                 │    │   (Optional)    │
│ • Redux Toolkit │    │ • PostgreSQL    │    │ • PyTorch       │
│ • React Query   │    │ • Redis Cache   │    │ • GPU Models    │
│ • Virtualization│    │ • Bull Queue    │    │ • ML Pipeline   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   Database      │
                        │ • Optimized     │
                        │   SQL Functions │
                        │ • GIN Indexes   │
                        └─────────────────┘
```

### Key Components

1. **Backend (`backend/`)** - Express.js REST API
   - `server.js` - Main entry point with middleware setup (CORS, rate limiting, compression)
   - `services/matchingService.js` - Core genetic matching logic with Redis caching
   - `routes/` - API endpoints (profiles, haplogroups, databases, samples, admin, keys, audit)
   - `config/database.js` - PostgreSQL connection pool management

2. **Frontend (`str-matcher/`)** - Next.js 15 application
   - Main page: `src/app/page.tsx` (client-side STR matching)
   - Backend search: `src/app/backend-search/page.tsx` (uses PostgreSQL backend)
   - State management: `src/store/` (Redux Toolkit with persistence middleware)
   - API client: `src/hooks/useBackendAPI.ts`

3. **Database (`database/`)** - PostgreSQL schemas and optimizations
   - `schema.sql` - Base schema with JSONB markers storage
   - `optimized-v5-marker-panel-filter.sql` - Critical: Panel-based filtering function
   - `api-keys-and-audit.sql` - API key authentication and audit logging

4. **CUDA Predictor (`cuda-predictor/`)** - Optional ML service for haplogroup prediction
   - `main.py` - FastAPI service with CNN/XGBoost ensemble models
   - Requires NVIDIA GPU with CUDA 11.8+

5. **Legacy Haplogroup Service (`ftdna_haplo/`)** - Legacy Express API (port 9003)

## Development Commands

### Full Stack Development
```bash
# Root level - runs both frontend and legacy API
npm run dev

# Individual services
cd backend && npm run dev              # Backend on port 9004
cd str-matcher && npm run dev          # Frontend on port 3000
cd cuda-predictor && python main.py    # CUDA service on port 8080 (optional)
```

### Building
```bash
npm run build                          # Build all services
npm run build:str-matcher              # Frontend only
cd backend && npm run build            # Not needed - backend is not transpiled
```

### Database Management
```bash
cd backend
npm run db:migrate                     # Apply migrations
npm run db:seed                        # Seed with test data

# Manual database operations
psql -U postgres -d ystr_matcher -f database/schema.sql
psql -U postgres -d ystr_matcher -f database/optimized-v5-marker-panel-filter.sql
```

### Production Deployment
```bash
npm start                              # Starts all services via PM2 (ecosystem.config.js)
pm2 logs                               # View logs
pm2 stop all                           # Stop all services
npm stop                               # Alternative stop command

# Docker Compose (recommended)
docker-compose up -d                   # Start all services
docker-compose logs -f backend         # View backend logs
docker-compose down                    # Stop all services
```

### Testing
```bash
cd backend && npm test                 # Backend unit tests

# Performance testing scripts (Node.js scripts in root)
node test-api-performance.js           # API load testing
node comprehensive-test.js             # Full system test
node test-cache-performance.js         # Redis cache performance
```

## Critical Implementation Details

### PostgreSQL Function Architecture

The system's performance depends on specialized PostgreSQL functions:

1. **`find_matches_batch` (v5)** - Main matching function with panel filtering
   - Location: `database/optimized-v5-marker-panel-filter.sql`
   - Prevents artificially high match percentages when comparing profiles with different marker counts
   - Parameters: `(query_markers JSONB, max_distance INT, max_results INT, marker_count INT, haplogroup_filter TEXT, include_subclades BOOL)`
   - Returns: Matched profiles with `genetic_distance`, `compared_markers`, `percent_identical`

2. **`calculate_genetic_distance`** - Core distance calculation
   - Location: `database/schema.sql:63-100`
   - Compares only markers present in BOTH profiles (intersection)
   - Returns: Integer count of differing markers

3. **Marker Panel Filtering** - Critical for accuracy
   - Ensures comparisons are limited to the requested panel size (12, 25, 37, 67, 111 markers)
   - Without this, a 12-marker profile could show 100% match against a 111-marker profile
   - See: `docs/MARKER-PANEL-FILTERING.md`

### Backend API Request Validation

**CRITICAL:** Joi validation in `backend/middleware/validation.js` uses `allowUnknown: false`, which rejects any undocumented fields. When frontend sends unexpected fields (like `undefined` values), requests fail with HTTP 400.

**Solution pattern:**
```javascript
// In frontend API calls, ensure no undefined/null fields are sent
const payload = {
  markers: { DYS393: "13", DYS390: "24" },
  maxDistance: 25,
  maxResults: 1000,
  markerCount: 37,
  // Only include optional fields if they have values
  ...(haplogroupFilter && { haplogroupFilter }),
  ...(includeSubclades && { includeSubclades })
};
```

See: `docs/API-ERROR-400-FIX.md`

### Redis Caching Strategy

`backend/services/matchingService.js` implements intelligent caching:
- **Match results**: Cached 1 hour (`cacheKey = 'match:...'`)
- **Profile lookups**: Cached 24 hours (`cacheKey = 'profile:{kitNumber}'`)
- **Statistics**: Cached 5 minutes (`cacheKey = 'db:statistics'`)
- Cache keys are automatically cleared on profile uploads

### Performance Considerations

1. **Marker Value Validation** - CRITICAL performance fix
   - Location: `backend/services/matchingService.js:29-34`
   - Non-numeric marker values cause 40x slowdown in PostgreSQL
   - Always validate: `/^[0-9]+(.[0-9]+)?(-[0-9]+(.[0-9]+)?)?$/`

2. **Batch Processing**
   - Upload endpoint processes profiles in batches via `bulk_insert_profiles` SQL function
   - Configured in `.env`: `MAX_PROFILES_PER_BATCH=50000`

3. **PostgreSQL Tuning**
   - Connection pool: 20-50 connections (configured in `.env`)
   - Parallel workers: 8-16 (see `docker-compose.yml:19`)
   - Index types: GIN for JSONB, B-tree for kit_number, hash for markers_hash

## Environment Configuration

### Backend `.env`
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ystr_matcher
DB_USER=postgres
DB_PASSWORD=<password>
DB_MAX_CONNECTIONS=50

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=9004
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000

# Performance
WORKER_CONCURRENCY=8
BATCH_SIZE=2000
MAX_PROFILES_PER_BATCH=50000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# API Keys (optional)
MASTER_API_KEY=<generate-secure-key>
```

### Frontend `.env.local` (str-matcher)
```env
NEXT_PUBLIC_API_URL=http://localhost:9004/api
NEXT_PUBLIC_CUDA_SERVICE_URL=http://localhost:8080
NEXT_PUBLIC_MAX_UPLOAD_SIZE=104857600
```

## Important Files to Understand

### Core Business Logic
- `backend/services/matchingService.js` - All genetic matching, caching, statistics
- `database/optimized-v5-marker-panel-filter.sql` - Main SQL matching function
- `str-matcher/src/hooks/useBackendAPI.ts` - Frontend API integration

### Database Schema
- `database/schema.sql` - Tables: `ystr_profiles`, `haplogroups`, `marker_statistics`
- `database/api-keys-and-audit.sql` - API authentication system

### Configuration
- `docker-compose.yml` - Full stack deployment with PostgreSQL tuning
- `ecosystem.config.js` - PM2 process management (legacy services on ports 9002, 9003)
- `backend/server.js` - Express middleware chain and route mounting

### Documentation
- `README-v2.md` - Complete setup and deployment guide (Russian)
- `PERFORMANCE-GUIDE.md` - PostgreSQL tuning and benchmarking
- `docs/MARKER-PANEL-FILTERING.md` - Critical accuracy fix
- `docs/API-ERROR-400-FIX.md` - Validation troubleshooting

## Common Development Patterns

### Adding New API Endpoints

1. Create route handler in `backend/routes/<resource>.js`:
```javascript
const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validation');
const Joi = require('joi');

const mySchema = Joi.object({
  field: Joi.string().required()
});

router.post('/endpoint', validateRequest(mySchema), async (req, res) => {
  try {
    const result = await matchingService.someMethod(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

2. Mount in `backend/server.js`:
```javascript
app.use('/api/resource', require('./routes/resource'));
```

### Adding New SQL Functions

1. Create migration file in `database/`:
```sql
-- database/add-new-function.sql
CREATE OR REPLACE FUNCTION function_name(params)
RETURNS return_type
LANGUAGE plpgsql
AS $$
BEGIN
  -- Implementation
END;
$$;
```

2. Apply manually or add to `docker-compose.yml` init scripts

### Frontend State Management

Uses Redux Toolkit with localStorage persistence:
- `src/store/store.ts` - Configure store
- `src/store/userSlice.ts` - User profile state
- `src/store/importedProfilesSlice.ts` - CSV imported profiles
- `src/store/storageMiddleware.ts` - Auto-persist to localStorage

## Troubleshooting

### Backend Returns 400 on Valid Requests
- Check Joi schema matches frontend payload exactly
- Remove undefined/null fields before sending
- See: `docs/API-ERROR-400-FIX.md`

### Slow Matching Performance (>5s for 200k profiles)
- Verify PostgreSQL `find_matches_batch` function is v5 or later
- Check marker values are numeric (run validation fix)
- Ensure indexes exist: `SELECT * FROM pg_indexes WHERE tablename = 'ystr_profiles';`

### Redis Connection Errors
- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL in `.env`
- Check firewall/Docker network connectivity

### Database Connection Pool Exhausted
- Increase `DB_MAX_CONNECTIONS` in `.env`
- Check for unclosed connections in code
- Monitor: `SELECT count(*) FROM pg_stat_activity WHERE datname = 'ystr_matcher';`

## Technology Stack

- **Backend**: Node.js 18+, Express 4.18, PostgreSQL 15, Redis 7
- **Frontend**: Next.js 15, React 18, Redux Toolkit, TypeScript 5
- **Database**: PostgreSQL with JSONB, GIN indexes, custom PL/pgSQL functions
- **Caching**: Redis with LRU eviction
- **ML (optional)**: Python 3.9+, PyTorch, FastAPI, CUDA 11.8+
- **Deployment**: PM2, Docker Compose, Nginx reverse proxy
- **Monitoring**: Prometheus metrics, optional ELK stack

## Project History

- Originally designed for local CSV-based matching
- v2.0: Migrated to PostgreSQL for scalability (100k-200k profiles)
- Critical fixes: Marker panel filtering, validation handling, performance optimizations
- Active development focus: Backend API and database performance

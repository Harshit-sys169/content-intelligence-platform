# Deployment Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- (Optional) Docker
- (Optional) PostgreSQL for scaling

---

## Local Development

### 1. Setup

```bash
git clone https://github.com/Harshit-sys169/content-intelligence-platform.git
cd content-intelligence-platform
npm install
cp .env.example .env
```

### 2. Configure .env

```env
PORT=3000
JWT_SECRET=your-long-random-secret-min-32-chars
ADMIN_USER=admin
ADMIN_PASSWORD=your-secure-password
DEMO_USER=demo
DEMO_PASSWORD=demo-password
COOKIE_SECURE=false
```

### 3. Run

```bash
# Development mode
npm start

# Or with nodemon (auto-restart on changes)
npx nodemon server.js
```

Visit http://localhost:3000

---

## Docker Deployment

### 1. Build Image

```bash
docker build -t content-intelligence-platform .
```

### 2. Run Container

```bash
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e JWT_SECRET=your-secret \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD=your-password \
  --name content-analyzer \
  content-intelligence-platform
```

### 3. Docker Compose

```bash
docker-compose up -d
```

**docker-compose.yml:**
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
```

---

## Production Deployment

### Option A: Heroku

```bash
# Login
heroku login

# Create app
heroku create content-intelligence-platform

# Set env vars
heroku config:set JWT_SECRET=your-very-secure-secret
heroku config:set ADMIN_PASSWORD=your-admin-password
heroku config:set COOKIE_SECURE=true

# Deploy
git push heroku main
```

### Option B: AWS EC2

```bash
# 1. Launch Ubuntu 22.04 t3.micro instance
# 2. Security group: allow 22 (SSH), 80 (HTTP), 443 (HTTPS)

# 3. SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# 4. Install Node
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 5. Clone repo
git clone <repo-url>
cd content-intelligence-platform

# 6. Install dependencies
npm ci --production

# 7. Create .env
sudo nano .env  # Add config

# 8. Install PM2 (process manager)
sudo npm install -g pm2
pm2 start server.js --name "content-app"
pm2 startup
pm2 save

# 9. Install Nginx (reverse proxy)
sudo apt-get install -y nginx

# 10. Configure Nginx
sudo nano /etc/nginx/sites-available/default
```

**Nginx config:**
```nginx
server {
    listen 80 default_server;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Install SSL (Let's Encrypt):**
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option C: DigitalOcean App Platform

```bash
# Push to GitHub
git push origin main

# Via dashboard:
# 1. Connect GitHub repo
# 2. Set build command: npm ci
# 3. Set run command: npm start
# 4. Add env vars (JWT_SECRET, ADMIN_PASSWORD, etc)
# 5. Deploy
```

### Option D: Railway / Render

**Railway:**
```bash
# Install CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

**Render:**
- Connect GitHub
- Select Node environment
- Build: `npm ci`
- Start: `npm start`
- Add env vars
- Deploy

---

## Production Configuration

### Security

```env
# Required
JWT_SECRET=super-long-random-secret-at-least-32-chars-recommended-64
ADMIN_PASSWORD=very-strong-password-min-12-chars
DEMO_PASSWORD=another-strong-password

# Production
COOKIE_SECURE=true
NODE_ENV=production
PORT=3000
```

### Performance

- **Compression:** Enabled by default (helmet)
- **Rate Limiting:** 120 req/min per endpoint
- **File Upload:** 2MB max
- **Body Limit:** 2MB JSON
- **Caching:** Set Cache-Control headers if using CDN

### Monitoring

```bash
# PM2 Monitoring
pm2 monit

# Or with dashboard
pm2 install pm2-auto-pull  # Auto-deploy on git push
pm2 install pm2-web        # Web dashboard
pm2 web                    # Visit http://localhost:9615
```

---

## Database Migration (Scaling)

When moving from JSON to PostgreSQL:

### 1. Install PostgreSQL

```bash
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres psql
```

### 2. Create Database

```sql
CREATE DATABASE content_app;
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE content_app TO app_user;
```

### 3. Create Tables

```sql
CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT,
  input TEXT,
  report JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at DESC)
);

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY,
  theme TEXT,
  density TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Update lib/store.js

```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function saveAnalysis(record) {
  const result = await pool.query(
    'INSERT INTO analyses (id, user_id, kind, title, input, report, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [record.id, record.userId, record.kind, record.title, record.input, JSON.stringify(record.report), new Date()]
  );
  return result.rows[0];
}
```

---

## Backup & Recovery

### File-Based (JSON)

```bash
# Backup
cp -r data/ data-backup-$(date +%Y%m%d)

# Automated (cron)
0 2 * * * cp -r /app/data /backups/data-$(date +\%Y\%m\%d)
```

### Database-Based (PostgreSQL)

```bash
# Backup
pg_dump -U app_user content_app > backup-$(date +%Y%m%d).sql

# Restore
psql -U app_user content_app < backup-20260520.sql
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### High Memory Usage

```bash
# Limit analyses stored (in store.js)
store.analyses = store.analyses.slice(0, 500);  // Keep last 500

# Or enable compression
app.use(express.json({ limit: '1mb' }));
```

### Slow Analysis

- Current: Local engine is <50ms
- If using LLM: Add caching or queue system
- Consider Bull.js for job queue

### Storage Issues

```bash
# Check disk usage
du -sh data/

# Archive old records
node scripts/archive-old.js --before 2026-01-01
```

---

## Scaling Strategy

**Stage 1: File-based (Current)**
- Suitable for: <100 users, <50k analyses
- Single Node.js instance
- Local JSON storage

**Stage 2: Add Database**
- PostgreSQL backend
- Connection pooling
- Multi-instance Node.js (with load balancer)

**Stage 3: Advanced**
- Redis for caching
- Message queue (Bull, RabbitMQ)
- LLM integration for rewrites
- CDN for static assets
- Separate API/UI services

---

**Last updated:** May 2026  
**Version:** 1.0.0

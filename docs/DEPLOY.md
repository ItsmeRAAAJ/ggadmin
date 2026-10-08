# My GGITS — Backend Production Deployment Guide

> **Target stack:** Ubuntu 22.04 LTS / Debian 12 VPS · Docker + Docker Compose v2 · Caddy (reverse proxy + automatic HTTPS) · PostgreSQL 16 (containerised) · AWS S3 (Mumbai `ap-south-1`)

---

## Table of Contents

1. [Pre-flight checklist](#1-pre-flight-checklist)
2. [Bug fix — docker-compose PORT mismatch](#2-bug-fix--docker-compose-port-mismatch)
3. [Server bootstrap (first time only)](#3-server-bootstrap-first-time-only)
4. [Clone the repo on the server](#4-clone-the-repo-on-the-server)
5. [Environment variables](#5-environment-variables)
6. [AWS S3 setup](#6-aws-s3-setup)
7. [Caddy reverse proxy](#7-caddy-reverse-proxy)
8. [First deploy — build and start](#8-first-deploy--build-and-start)
9. [Database migration and seeding](#9-database-migration-and-seeding)
10. [Verify everything is healthy](#10-verify-everything-is-healthy)
11. [Zero-downtime redeploys](#11-zero-downtime-redeploys)
12. [Rollback](#12-rollback)
13. [Monitoring and logs](#13-monitoring-and-logs)
14. [Security hardening checklist](#14-security-hardening-checklist)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Pre-flight checklist

Before you touch the server, make sure you have:

- [ ] A VPS with **at least 1 GB RAM, 1 vCPU, 20 GB SSD** (2 GB RAM recommended for Node build)
- [ ] A domain name with two A-records pointing to the server IP:
  - `api.yourdomain.com` → server IP  (backend)
  - `admin.yourdomain.com` → server IP  (Next.js admin panel, optional at this stage)
- [ ] **Brevo** account with a verified sender domain and API key ready
- [ ] **AWS IAM user** with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the target bucket
- [ ] SSH access to the server as a non-root `sudo` user

---

## 2. Bug fix — docker-compose PORT mismatch

> ⚠️ **CAUTION:** The current `docker/docker-compose.prod.yml` sets `PORT: 4000` but the `Dockerfile` has `EXPOSE 3001` and the healthcheck defaults to port `3001`. **Apply this fix before deploying.**

Open `docker/docker-compose.prod.yml` and change the `backend` service:

```yaml
# docker/docker-compose.prod.yml  — corrected backend block

  backend:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile
    restart: always
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: 3001            # ← was 4000 — must match Dockerfile EXPOSE + HEALTHCHECK
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - internal
    ports:
      - "127.0.0.1:${BACKEND_HOST_PORT:-3001}:3001"   # ← was 4000:4000
```

Also update the `.env.example` default:

```dotenv
BACKEND_HOST_PORT=3001   # was 4000
```

**Why?** The `Dockerfile` runs `node dist/src/index.js` which reads `env.PORT` (defaulting to `3001`). The Docker-internal port, the compose port mapping, and the `BACKEND_HOST_PORT` exposed to the host must all agree. Caddy then proxies to `127.0.0.1:3001` on the host side.

---

## 3. Server bootstrap (first time only)

SSH into your server and run these once:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker (official script)
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (log out & back in after this)
sudo usermod -aG docker $USER
newgrp docker   # or just re-login

# Verify Docker Compose v2
docker compose version   # should print v2.x

# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# Install Git
sudo apt install -y git

# UFW firewall: allow SSH, HTTP, HTTPS only
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status   # verify 3001 and 5432 are NOT in the list
```

---

## 4. Clone the repo on the server

```bash
# Choose a deploy directory
sudo mkdir -p /opt/myggits
sudo chown $USER:$USER /opt/myggits

cd /opt/myggits
git clone https://github.com/<your-org>/my-ggits.git .
# or using SSH key:
# git clone git@github.com:<your-org>/my-ggits.git .
```

All subsequent commands assume `/opt/myggits` as your root.

---

## 5. Environment variables

The compose file loads environment from `docker/.env`.

```bash
cp my-ggits/docker/.env.example my-ggits/docker/.env
nano my-ggits/docker/.env    # fill in every value below
```

### Full variable reference

```dotenv
# ── Postgres ──────────────────────────────────────────────────────────────
POSTGRES_USER=myggits_admin
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DB=myggits_prod

# Host must be "postgres" (the compose service name)
# User / password / db must match the three values above
DATABASE_URL=postgresql://myggits_admin:<POSTGRES_PASSWORD>@postgres:5432/myggits_prod

# ── Auth ──────────────────────────────────────────────────────────────────
JWT_SECRET=<openssl rand -hex 32>       # min 32 characters
OTP_PEPPER=<openssl rand -hex 32>       # min 32 characters

# ── Email (Brevo) ─────────────────────────────────────────────────────────
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=otp@mail.shubhashish.me
BREVO_SENDER_NAME=My GGITS

# ── AWS S3 ────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=<secret key>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=myggitsdev          # exact bucket name

# ── App ───────────────────────────────────────────────────────────────────
APP_NAME=My GGITS
ALLOWED_ORIGINS=https://admin.yourdomain.com
TRUST_PROXY_HOPS=1                # number of proxies in front (Caddy = 1)
BACKEND_HOST_PORT=3001

# ── Seed (used once, during first-run seeding only) ───────────────────────
SEED_ADMIN_EMAIL=admin@ggits.ac.in
SEED_ADMIN_PASSWORD=<strong password — save in password manager>
```

Generate secrets quickly:

```bash
openssl rand -hex 32   # for JWT_SECRET
openssl rand -hex 32   # for OTP_PEPPER
openssl rand -hex 24   # for POSTGRES_PASSWORD
```

Lock the file:

```bash
chmod 600 /opt/myggits/my-ggits/docker/.env
```

> **Never commit `docker/.env` to git.** It is already in `.gitignore`.

---

## 6. AWS S3 setup

### 6.1 CORS (required for presigned PUT from mobile)

In the AWS Console → S3 → your bucket → **Permissions** → **CORS**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### 6.2 Block Public Access

**Keep "Block all public access" ON.** Files are served only via presigned `GET` URLs generated by the backend — never publicly accessible.

### 6.3 IAM user policy

Create IAM user `myggits-backend` with this inline policy (replace bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::myggitsdev/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::myggitsdev"
    }
  ]
}
```

Put the Access Key ID and Secret in `docker/.env`.

---

## 7. Caddy reverse proxy

Caddy handles TLS certificates automatically (Let's Encrypt). No manual `certbot` needed.

Create `/etc/caddy/Caddyfile`:

```caddyfile
# /etc/caddy/Caddyfile

api.yourdomain.com {
    reverse_proxy 127.0.0.1:3001 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    encode gzip

    log {
        output file /var/log/caddy/api.log {
            roll_size 50mb
            roll_keep 5
        }
    }
}
```

Reload:

```bash
sudo systemctl enable --now caddy
sudo caddy validate --config /etc/caddy/Caddyfile   # dry-run check
sudo systemctl reload caddy
```

> **Note:** The `docker/nginx.conf` in the repo is a legacy reference file. **Do not use it** — Caddy replaces it completely with automatic HTTPS and simpler config.

---

## 8. First deploy — build and start

```bash
cd /opt/myggits/my-ggits

# Build the backend image and start all containers
docker compose -f docker/docker-compose.prod.yml up -d --build

# Watch startup logs (Ctrl+C stops following, containers keep running)
docker compose -f docker/docker-compose.prod.yml logs -f
```

**Expected log sequence:**

1. `postgres` → `database system is ready to accept connections`
2. `backend` → Prisma prints migration summary (e.g. `All migrations have been applied`)
3. `backend` → `Database connected`
4. `backend` → `My GGITS backend running on port 3001`

First build takes ~3–5 minutes (downloading base images + `npm install`).

---

## 9. Database migration and seeding

### 9.1 Migrations (automatic on every start)

The Dockerfile `CMD` is:

```sh
npx prisma migrate deploy && node dist/src/index.js
```

`prisma migrate deploy` applies any un-applied SQL migration files from `prisma/migrations/`. It never generates new migrations, never rolls back. Safe for production restarts.

Current migrations that will be applied on first run:

| Migration | What it does |
|-----------|-------------|
| `20260926103301_init` | Initial schema |
| `20260930100422_schema_additions` | Permissions, teacher hierarchy, assignments, achievements |
| `20260930100833_drop_resume_url_add_dual_resume` | Tech + non-tech resume fields |
| `20260930103018_add_audit_metadata` | AuditLog.metadata field |
| `20260930164526_auth_and_academic_hardening` | Auth and academic model hardening |
| `20261003214040_academics_restructure` | Academic module restructure |

### 9.2 First-run seed (once only)

Seeds: all Branches, Roles, Permissions, and the initial Super Admin account.

```bash
docker compose -f docker/docker-compose.prod.yml exec backend \
  node dist/prisma/seed.js
```

Confirm with a quick check:

```bash
docker compose -f docker/docker-compose.prod.yml exec postgres \
  psql -U myggits_admin -d myggits_prod \
  -c 'SELECT email, "createdAt" FROM "User" ORDER BY "createdAt" LIMIT 5;'
```

> The seed script is idempotent (uses upsert), but avoid re-running it in production unnecessarily.

---

## 10. Verify everything is healthy

```bash
# Container status
docker compose -f docker/docker-compose.prod.yml ps

# Health endpoint (local)
curl http://127.0.0.1:3001/health
# Expected: {"status":"ok"}

# Health via public domain (tests Caddy + TLS + backend end-to-end)
curl https://api.yourdomain.com/health

# Auth system sanity
curl https://api.yourdomain.com/auth/login-categories
# Expected: {"data":["STUDENT","TEACHER","ADMIN"]}
```

---

## 11. Zero-downtime redeploys

Every time you ship new code:

```bash
cd /opt/myggits/my-ggits

# 1. Pull latest
git pull origin main

# 2. Rebuild backend only (Postgres data volume is untouched)
docker compose -f docker/docker-compose.prod.yml up -d --build backend

# 3. Tail logs to confirm clean startup
docker compose -f docker/docker-compose.prod.yml logs -f backend
```

Postgres keeps running. The new backend image starts, runs any new migrations, then replaces the old container. There is a ~5–10 second gap during switchover — acceptable for this scale.

---

## 12. Rollback

If a bad deploy breaks things:

```bash
cd /opt/myggits/my-ggits

# Find the last working commit
git log --oneline -10

# Check out that commit
git checkout <good-commit-hash>

# Rebuild from that commit
docker compose -f docker/docker-compose.prod.yml up -d --build backend
```

> ⚠️ **Never run `prisma migrate dev` on the production server.** Only `prisma migrate deploy` is safe. Rolling back a schema migration requires a manual SQL script — design migrations carefully.

---

## 13. Monitoring and logs

### Live log tailing

```bash
# All services
docker compose -f docker/docker-compose.prod.yml logs -f

# Backend only
docker compose -f docker/docker-compose.prod.yml logs -f backend

# Postgres only
docker compose -f docker/docker-compose.prod.yml logs -f postgres
```

### Log rotation (prevent disk fill)

Create `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

```bash
sudo systemctl restart docker
# Then bring containers back up:
docker compose -f docker/docker-compose.prod.yml up -d
```

### Disk space

```bash
df -h                    # overall disk
docker system df         # Docker volumes, images, containers
docker image prune -f    # clean old images safely
```

### Uptime monitoring (recommended)

Set up [UptimeRobot](https://uptimerobot.com) (free):
- Monitor: `https://api.yourdomain.com/health`
- Interval: 5 minutes
- Alert: Slack or email

---

## 14. Security hardening checklist

- [ ] `docker/.env` is **not in git** and is `chmod 600`
- [ ] Postgres is **not exposed publicly** — only on the `internal` Docker network ✓
- [ ] Backend port `3001` is bound to `127.0.0.1` only, not `0.0.0.0` ✓
- [ ] UFW allows only ports 22, 80, 443 (no 3001, no 5432 exposed)
- [ ] `JWT_SECRET` and `OTP_PEPPER` are ≥ 32 random bytes each
- [ ] `SEED_ADMIN_PASSWORD` is strong and stored in a password manager
- [ ] S3 **Block Public Access** is enabled — files served via signed URLs only
- [ ] Brevo sender domain has **SPF + DKIM** configured (avoids OTPs landing in spam)
- [ ] Caddy `HSTS` header is set ✓
- [ ] Rate limiting on `/auth/*` routes is enabled in the backend ✓
- [ ] `NODE_ENV=production` disables stack traces in error responses ✓
- [ ] Change the default Super Admin password after first login

---

## 15. Troubleshooting

### Container crashes immediately

```bash
docker compose -f docker/docker-compose.prod.yml logs backend
```

| Log message | Fix |
|---|---|
| `Missing required env var: DATABASE_URL` | `docker/.env` missing or a required var is empty |
| `connect ECONNREFUSED postgres:5432` | Postgres not yet healthy — wait 10s, check postgres logs |
| `Cannot find module './dist/src/index.js'` | TypeScript build failed — look for TS errors in `--build` output |
| `relation "User" does not exist` | Migrations didn't run — exec into container and run `npx prisma migrate deploy` |

### Manually run migrations

```bash
docker compose -f docker/docker-compose.prod.yml exec backend \
  npx prisma migrate deploy
```

### OTPs not arriving

1. Check `BREVO_API_KEY` in `docker/.env`
2. Verify sender domain is confirmed in Brevo dashboard
3. Check backend logs:
   ```bash
   docker compose -f docker/docker-compose.prod.yml logs backend | grep -i "email\|brevo\|otp"
   ```
4. Check spam folder; ensure SPF/DKIM are set up for the sender domain

### S3 presigned upload returns 403

1. IAM user has `s3:PutObject` on the right bucket?
2. `AWS_S3_BUCKET` in `.env` matches exactly (case-sensitive)?
3. Bucket CORS allows `PUT` from `*`?
4. Presigned URLs expire in 15 min — don't reuse stale ones

### `curl https://api.yourdomain.com/health` returns 502

Caddy can reach the server but not the backend. Check:

```bash
# Is the backend actually listening on 3001?
ss -tlnp | grep 3001

# Is the container running?
docker compose -f docker/docker-compose.prod.yml ps

# Does Caddyfile have the right port?
grep proxy /etc/caddy/Caddyfile
```

### Prisma Studio (read the live DB)

```bash
# On the server (binds to localhost only)
docker compose -f docker/docker-compose.prod.yml exec backend npx prisma studio

# On your local machine — tunnel to it:
ssh -L 5555:localhost:5555 user@your-server-ip
# Then open http://localhost:5555 in your browser
```

---

## Quick Reference — All deploy commands

```bash
# Working directory
cd /opt/myggits/my-ggits

# ── First deploy ────────────────────────────────────────────────────────
docker compose -f docker/docker-compose.prod.yml up -d --build

# ── Run seed (first time only) ──────────────────────────────────────────
docker compose -f docker/docker-compose.prod.yml exec backend node dist/prisma/seed.js

# ── Redeploy after code changes ─────────────────────────────────────────
git pull origin main
docker compose -f docker/docker-compose.prod.yml up -d --build backend

# ── View logs ───────────────────────────────────────────────────────────
docker compose -f docker/docker-compose.prod.yml logs -f
docker compose -f docker/docker-compose.prod.yml logs -f backend

# ── Check status ────────────────────────────────────────────────────────
docker compose -f docker/docker-compose.prod.yml ps

# ── Stop everything (data preserved) ────────────────────────────────────
docker compose -f docker/docker-compose.prod.yml down

# ── Stop and WIPE database volume (⚠️ destructive) ──────────────────────
docker compose -f docker/docker-compose.prod.yml down -v

# ── Run migrations manually ─────────────────────────────────────────────
docker compose -f docker/docker-compose.prod.yml exec backend npx prisma migrate deploy

# ── Open Prisma Studio (tunnel first: ssh -L 5555:localhost:5555 …) ─────
docker compose -f docker/docker-compose.prod.yml exec backend npx prisma studio

# ── Clean up old Docker images ───────────────────────────────────────────
docker image prune -f
```

---

*Last updated: October 2026 — My GGITS v1 production deployment*

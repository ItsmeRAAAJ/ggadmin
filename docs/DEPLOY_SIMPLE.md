## 5. Environment variables

The compose file loads environment from `docker/.env`.

```bash
cp my-ggits/docker/.env.example my-ggits/docker/.env
nano my-ggits/docker/.env    # fill in every value below
```

```bash
openssl rand -hex 32   # for JWT_SECRET
openssl rand -hex 32   # for OTP_PEPPER
openssl rand -hex 24   # for POSTGRES_PASSWORD
```

```txt
POSTGRES_USER=myggits_admin
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DB=myggits_prod

DATABASE_URL=postgresql://myggits_admin:<POSTGRES_PASSWORD>@postgres:5432/myggits_prod

JWT_SECRET=<openssl rand -hex 32>       # min 32 characters
OTP_PEPPER=<openssl rand -hex 32>       # min 32 characters

BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=otp@mail.shubhashish.me
BREVO_SENDER_NAME=My GGITS

AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=<secret key>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=myggitsdev          # exact bucket name

APP_NAME=My GGITS
ALLOWED_ORIGINS=https://admin.yourdomain.com
TRUST_PROXY_HOPS=1                # number of proxies in front (Caddy = 1)
BACKEND_HOST_PORT=3001

# used once, during first-run seeding only
SEED_ADMIN_EMAIL=admin@ggits.ac.in
SEED_ADMIN_PASSWORD=<strong password — save in password manager>
```

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
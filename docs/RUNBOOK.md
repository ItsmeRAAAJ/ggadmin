# 🏃‍♂️ My GGITS — Runbook & Local Dev Guide

This is the **single source of truth** for starting all services, testing the flows end to end, and deploying. Follow it top to bottom when setting up for the first time.

| Service | Tech | Local URL |
|---|---|---|
| Postgres | Docker (`postgres:16-alpine`) | `localhost:5432` |
| Backend API | Express + Prisma 7 (Docker) | `http://localhost:3001` |
| Admin / Teacher panel | Next.js | `http://localhost:3000` |
| Student app | Expo (React Native) | Dev client / simulator — Home / Profile / Academics |

---

## 1. Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | **v24+** (see root `package.json` → `engines`) | `node --version` |
| npm | **v11+** | `npm --version` |
| Docker Desktop | Latest (Compose v2.24+) | `docker compose version` |
| Xcode / Android Studio | Latest | For simulators / emulators |

> The root `package.json` pins `typescript ~5.9.3` and `@babel/core ^7.29` for the Next.js + Expo apps. The backend uses its own nested TypeScript 7 (`tsc -b`). Don't remove these pins.

---

## 2. First-Time Setup

```bash
# From the monorepo root: my-ggits/
npm install

# Generate the Prisma client for host-side backend commands (monorepo hoisting fix)
cd apps/backend && npm run db:generate && cd ../..
```

> Re-run `npm run db:generate` in `apps/backend` after **every** `npm install`.

### Environment files

| File | Needed for | How |
|---|---|---|
| `apps/backend/.env` | Backend (host dev), extra keys for Docker (AWS, Brevo, seed admin) | `cp apps/backend/.env.example apps/backend/.env` |
| `apps/admin-panels/.env.local` | Admin panel | `NEXT_PUBLIC_API_URL=http://localhost:3001` |
| `apps/mobile/.env` | Optional in dev | `EXPO_PUBLIC_API_URL=...` (see §5) |

Key backend variables:

- `BREVO_API_KEY` — **leave empty locally** to get OTPs printed in the backend logs instead of emailed. When set, real emails are sent.
- `AWS_*` — needed for profile photos, resumes, certificates, assignments and academic-resource uploads (private S3 presigned URLs and deletion).
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — the first Super Admin created by the seed.
- `ALLOWED_ORIGINS` — admin panel origin(s) for CORS. Empty = allow all in development only.

---

## 3. Start the Backend Stack (Docker)

The root `docker-compose.yml` starts **Postgres** and the **Backend API**.

```bash
# From: my-ggits/
docker compose up --build
```

**What this does:**
1. Builds the backend image (TypeScript → `dist/`, including the compiled seed script).
2. Starts Postgres on `5432` (`mygg` / `root` / `myggits-dev`) and waits until it's healthy.
3. Backend runs `prisma migrate deploy` (creates/updates tables and removes the retired assessment schema).
4. Backend runs the **idempotent seed**: branches, admin roles, permissions (including `MODERATE_PEER_RESOURCES`) and the first Super Admin (skipped if it already exists). Safe on every start.
5. API goes live at `http://localhost:3001` — check with `curl localhost:3001/health`.

> **Assessment-data migration:** the academics restructure intentionally deletes the old online-assessment tables and their data. Back up any database whose assessment history must be retained before deploying this version. `docker compose down -v` also deletes the entire local database.

Notes:
- `apps/backend/.env` is **optional** for Docker. If present, its values (AWS, Brevo, `SEED_ADMIN_*`, `ALLOWED_ORIGINS`) are used; `DATABASE_URL`, `NODE_ENV`, `PORT`, `JWT_SECRET` and `OTP_PEPPER` are always set by compose.
- To override the Postgres credentials or secrets, put `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET`, `OTP_PEPPER` in a root `my-ggits/.env`.

```bash
docker compose up --build -d          # run in background
docker compose logs backend -f        # follow API logs (OTPs appear here)
docker compose down                   # stop
docker compose down -v && docker compose up --build   # ⚠️ wipe DB and start clean
```

---

## 4. Super Admin Login

The seed creates the first Super Admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (in `apps/backend/.env`). If those aren't set, it uses:

- Email: `admin@ggits.ac.in`
- Password: `Admin@GGITS2024!`

The seed log (`docker compose logs backend`) prints the email it used.

> ⚠️ **Change the Super Admin password after first login** (sidebar → **Change password**). Use a strong password in production.

Running the seed manually (e.g. without Docker):

```bash
# From: my-ggits/apps/backend (uses DATABASE_URL from .env)
npm run db:seed                                  # via tsx
# or, inside the container:
docker compose exec backend node dist/prisma/seed.js
```

---

## 5. Start the Frontends

### Admin / Teacher panel (Next.js)

```bash
cd apps/admin-panels
npm run dev            # http://localhost:3000
```

Log in at `http://localhost:3000`, choosing the right **Role category** (Super Admin / Admin / Teacher) on the sign-in form.

Production-mode check: `npm run build && npx next start -p 3000`.

### Student app (Expo)

The app uses native modules (image picker, document picker, SVG), so use a **development build**, not Expo Go:

```bash
cd apps/mobile
npx expo run:ios        # or: npx expo run:android   (first time / after native dependency changes)
npm run start           # later runs: start Metro and open the installed dev client
```

- **API URL in development:** if `EXPO_PUBLIC_API_URL` isn't set, the app automatically uses `http://<your Mac's LAN IP>:3001` (from Metro), so a phone on the same Wi-Fi works without extra config.
- To force a URL, create `apps/mobile/.env` with `EXPO_PUBLIC_API_URL=http://192.168.x.x:3001` (find the IP with `ipconfig getifaddr en0`) and restart Metro with `npx expo start -c`.
- **Preview/production builds must set `EXPO_PUBLIC_API_URL`** to the HTTPS API URL (e.g. via EAS environment variables). Builds use `eas build --profile preview|production`.
- Study resources and peer shares accept PDF, PNG/JPG/HEIC, PPTX, DOCX and XLSX files up to 25 MB. No new native dependency was introduced for this update; rebuild the development client only if its installed native modules do not already include `expo-document-picker`.

---

## 6. Student CSV Format (Bulk Upload)

Admin Panel → **Students → Import students**. Max 5,000 rows per file.

```csv
enrollmentNumber,email,branchCode,admissionYear,currentSemester,section
0206IS241034,first.last.is24@ggits.net,IS,2024,3,A
0206CS231035,jane.doe.cs23@ggits.net,CS,2023,,
```

| Field | Required | Format | Example |
|-------|---|--------|---------|
| `enrollmentNumber` | ✅ | `\d{4}[A-Z]{2}\d{2}\d{4}` | `0206IS241034` |
| `email` | ✅ | `firstname.lastname.<branch><yy>@ggits.net` | `first.last.is24@ggits.net` |
| `branchCode` | ✅ | A seeded branch short code | `IS`, `CS`, `EC`… |
| `admissionYear` | ✅ | 4-digit year | `2024` |
| `currentSemester` | optional | 1–8 | `3` |
| `section` | optional | up to 10 chars | `A` |

Header aliases like `enrollment`, `enrollmentNo`, `branch`, `semester` are accepted. Re-uploading is safe.

**Per-row outcome:**
- ✅ **inserted** — new student created (status *Pending activation*).
- 🔄 **updated** — student exists but hasn't activated yet; details refreshed.
- 🔒 **skipped-protected** — student already activated; not touched.
- ❌ **invalid** — bad format, unknown branch, or email already used (reason shown).

**Seeded branch codes:** `CS`, `IS`, `EC`, `ME`, `CE`, `EE`, `CSEAIML`, `CSEIOT`, `CSEDC`.

---

## 7. End-to-End Test Flow

### A. Admin setup (admin panel, as Super Admin)
1. Log in (§4).
2. **Branches / Subjects** — create subjects (branch + semester).
3. **Teachers** — add a teacher (email + tier + primary branch).
4. **Teacher assignments** — assign the teacher to a subject + section.
5. **Students** — upload the CSV (§6) or add a single student; open a student to change semester / section / status.
6. **Admins / Admin roles / Permissions** — create sub-admins and grant permissions (non–Super Admins only see what they're granted).
7. **Audit logs** — every admin action is recorded here.

### B. Teacher (admin panel)
1. Open `http://localhost:3000/activate`, enter the teacher's email → OTP (from logs) → set password.
2. Sign in with Role category **Teacher**.
3. **Assignments** → New → Publish → later grade submissions → Close.
4. **Academics → Deadlines** → create and maintain practical-file, lab-record and other submission deadlines for assigned subjects.
5. **Academics → Resources** → create subject folders, upload study files, and organize files for students.
6. To let a teacher moderate student shares, grant **MODERATE_PEER_RESOURCES** using the teacher's permissions / hierarchy controls. Admin moderators need the same permission from **Admin → Permissions**; Super Admins always have it.

### C. Student (mobile app)
1. Enter the enrollment number or college email → **Continue** → OTP is sent.
2. Get the OTP (with `BREVO_API_KEY` empty):
   ```bash
   docker compose logs backend -f | grep "OTP for"
   # [EMAIL:dev] OTP for first.last.is24@ggits.net: 123456
   ```
3. Enter the OTP → set a password (8–72 chars, at least 1 uppercase, 1 lowercase, 1 number) → you're in.
4. Explore **Home**, **Profile** (photo, resumes, certifications, projects, achievements and links), and **Academics**:
   - **Assignments** — view and submit assignments.
   - **Deadlines** — see upcoming and past dates for practical files, lab records and other work.
   - **Resources** — browse teacher-uploaded material by subject, folder and file.
   - **Share with Peers** — search/filter class, branch and semester posts; share a file or link and remove your own posts.
5. Verify a student's section is set before testing **My class** visibility and class-scoped sharing. Branch and semester sharing do not require a section.

The API paths, payloads, visibility rules and upload types for these modules are documented in [`ACADEMICS_API.md`](ACADEMICS_API.md).

---

## 8. Manual Backend Dev (Without Docker for the API)

```bash
# Terminal A — only Postgres in Docker (from my-ggits/)
docker compose up -d postgres
docker compose stop backend      # free port 3001 if the container is running

# Terminal B — backend with hot reload (from my-ggits/apps/backend)
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

New migration after editing `prisma/schema.prisma`:
```bash
npx prisma migrate dev --name <description>
```
Commit the generated folder under `prisma/migrations/` — Docker and production apply it with `migrate deploy`.

---

## 9. Production Deployment (VM + Caddy)

Production uses `docker/docker-compose.prod.yml` (Postgres + API). Postgres is not published; the API is bound to `127.0.0.1:${BACKEND_HOST_PORT:-4000}` so only Caddy can reach it.

```bash
# On the VM, first time
cd my-ggits/docker
cp .env.example .env          # fill in EVERY value — strong secrets: openssl rand -hex 32
docker compose -f docker-compose.prod.yml up -d --build
curl http://127.0.0.1:4000/health

# One-time: create branches / roles / permissions / first Super Admin
docker compose -f docker-compose.prod.yml exec backend node dist/prisma/seed.js

# Redeploy
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build
```

Caddyfile entry:
```
api.your-domain.com {
    reverse_proxy localhost:4000
}
```

**Production checklist:**
- [ ] `docker/.env`: real `POSTGRES_PASSWORD`, `JWT_SECRET`, `OTP_PEPPER` (32+ random chars), `DATABASE_URL` matching the Postgres values with host `postgres`.
- [ ] `BREVO_API_KEY` set (OTP emails fail in production without it) and sender domain verified.
- [ ] `AWS_*` set; S3 bucket is private and its CORS allows `PUT` from the admin panel origin.
- [ ] Backend S3 role has `s3:GetBucketVersioning` on this bucket ARN, plus `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on this bucket's object ARNs only. For versioned buckets, also grant `s3:ListBucketVersions` on the bucket ARN and `s3:DeleteObjectVersion` on object ARNs.
- [ ] `ALLOWED_ORIGINS` = the admin panel's HTTPS origin(s).
- [ ] `SEED_ADMIN_PASSWORD` strong; change it after first login.
- [ ] Admin panel deployed with `NEXT_PUBLIC_API_URL=https://api.your-domain.com`.
- [ ] Mobile EAS builds use `EXPO_PUBLIC_API_URL=https://api.your-domain.com`.
- [ ] Grant permissions to sub-admins (they have none by default).
- [ ] Postgres backups scheduled (`pg_dump` from the `postgres` container).
- [ ] Don't reuse the dev database or dev S3 bucket — they contain test data.

---

## 10. Useful Docker Commands

```bash
docker compose ps                                   # status + health
docker compose logs backend -f                      # API logs
docker compose logs postgres -f                     # DB logs
docker compose up --build -d backend                # rebuild + restart only the API

# Postgres shell
docker compose exec postgres psql -U mygg -d myggits-dev
docker compose exec postgres psql -U mygg -d myggits-dev -c 'SELECT "shortCode", name FROM "Branch";'

# Prisma Studio (from apps/backend, uses .env DATABASE_URL → localhost:5432)
npm run db:studio
```

---

## 11. Troubleshooting

**`Cannot find module '@prisma/client'` / `.prisma/client/default`** (host only)
```bash
cd apps/backend && npm run db:generate
```

**`P1001: Can't reach database server at localhost:5432`** — Postgres isn't running: `docker compose up -d postgres`.

**`port is already allocated` (3001 or 5432)** — something else is using the port (`lsof -nP -iTCP:3001 -sTCP:LISTEN`). Stop the host backend (`npm run dev`) before `docker compose up`, or vice versa.

**Backend container keeps restarting** — `docker compose logs backend`. Usual causes: a failed migration or a missing env var. Always run compose from `my-ggits/` (where `docker-compose.yml` lives).

**Admin panel can't reach the backend / CORS error** — check `NEXT_PUBLIC_API_URL` in `apps/admin-panels/.env.local` (restart `npm run dev` after changing it) and that `ALLOWED_ORIGINS` includes `http://localhost:3000` (or is empty in development).

**Mobile app can't connect on a physical device** — the phone and Mac must be on the same Wi-Fi; allow incoming connections on port 3001 in the macOS firewall; or set `EXPO_PUBLIC_API_URL` explicitly (§5) and restart Metro with `-c`.

**Mobile app crashes on image/document pick or icons** — the dev client is outdated. Rebuild it: `npx expo run:ios` / `npx expo run:android`.

**OTP not in the logs** — `BREVO_API_KEY` is set, so it was emailed instead. Empty it in `apps/backend/.env` and `docker compose up -d` to log OTPs locally.

**"Too many requests"** — OTP/login rate limits (5 OTPs per hour per user, 60 s resend cooldown). Wait, or wipe the local DB.

**File uploads fail** — `AWS_*` missing/invalid, or the bucket CORS doesn't allow `PUT` from your origin.

**A stored file says “failed to load”** — S3 GET links expire after one hour. Refresh the app or re-fetch the API record for a new signed link. If a newly fetched link still fails, check that the referenced S3 object exists and that the backend's bucket, region, credentials and `s3:GetObject` permission match the bucket; private objects are never served through public URLs.

### S3 object layout and deletion

New uploads keep the existing stable, purpose-specific prefixes and add a sanitized original filename after a random identifier:

```text
students/{profileId}/photo/{uuid}-{filename}.{ext}
students/{profileId}/resume-tech/{uuid}-{filename}.pdf
students/{profileId}/resume-non-tech/{uuid}-{filename}.pdf
students/{profileId}/certificates/{uuid}-{filename}.{ext}
students/{profileId}/achievements/{uuid}-{filename}.{ext}
students/{profileId}/assignments/{assignmentId}/{uuid}-{filename}.{ext}
students/{profileId}/peer-resources/{uuid}-{filename}.{ext}
subjects/{subjectId}/resources/{folderId}/{uuid}-{filename}.{ext}
```

Names are basename-only, ASCII-sanitized, capped in length, and never used as the object's identity; generated IDs and the established folders remain authoritative. Existing keys and database URLs remain valid—there is no bulk rename or migration. Delete/replace operations remove the exact referenced key from S3 before changing its database record; S3 deletion failures return an error and leave the database record in place. In versioned or versioning-suspended buckets, the backend also deletes all versions and delete markers for that exact key. Do not grant delete access to an entire prefix or run broad bucket/prefix cleanup.

Objects uploaded but never attached to a database record, or leftovers from earlier best-effort cleanup, are not automatically swept. Reconcile inventory against database references before manually removing any orphan; do not delete objects based only on age or folder name.

**`expo-doctor` complains about React versions** — expected in the monorepo (admin panel's React 19.2.8 is hoisted). `expo.install.exclude` in `apps/mobile/package.json` suppresses it safely.

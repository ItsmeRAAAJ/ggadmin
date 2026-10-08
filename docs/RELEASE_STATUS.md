# My GGITS — Release Status & Handover

_Last updated: 4 Oct 2026_

## 1. Build status

| Area | Status | Verification |
|---|---|---|
| Backend API (auth, profiles, academics, assignments, deadlines, resources, peer sharing and moderation) | ✅ Implemented | Type-check clean; academics API smoke checks passed against a temporary database |
| Docker (local + production compose) | ⚠️ Migration ready | `docker compose up --build` applies the migration and seed; review the assessment-data warning in `RUNBOOK.md` before using an existing database |
| Student mobile app (Home / Profile / Academics) | ✅ Implemented | TypeScript and lint checks clean; final device/API testing remains |
| Admin panel — teacher side | ✅ Implemented | TypeScript, lint and production build clean; final role/permission and browser testing remains |
| Admin panel — admin side | ✅ Implemented | TypeScript, lint and production build clean; final role/permission and browser testing remains |

## 2. Academics restructure

- The online Assessment/quiz feature has been removed from the backend, mobile app and teacher panel.
- Mobile tabs are **Home / Profile / Academics**. Academics links to Assignments, Deadlines, Resources and Share with Peers.
- Students can browse teacher resources by subject/folder, and browse, search, filter, post and delete their own peer resources.
- Admins and teachers with `MODERATE_PEER_RESOURCES` can moderate student posts; moderation removals are audited.
- Resource/peer file uploads allow PDF, PNG/JPG/HEIC, PPTX, DOCX and XLSX up to 25 MB.
- API contracts and local/production run steps are in [`ACADEMICS_API.md`](ACADEMICS_API.md) and [`RUNBOOK.md`](RUNBOOK.md).

## 3. Please test manually

- Start from a database backup if it contains data you need to keep. The academics migration drops the retired assessment tables and their data.
- Run `docker compose up --build` and verify migration, seed and `/health` using the RUNBOOK.
- Admin → **Teachers → [teacher]** and **Admins → [admin]**: grant/revoke permissions; confirm only moderators can access peer-post moderation.
- Admin → **Students → Import students** (CSV upload with valid, invalid and duplicate rows) and **Add student**.
- Admin → **Teachers → Add** and **Admins → Add**, then activate those accounts via `/activate`.
- Teacher: create/edit/delete deadlines, create resource folders, upload/delete files, and moderate a peer post.
- Student app end to end on a real device: login + OTP, forgot password, profile uploads, assignment upload + submit, upcoming/past deadlines, resource browsing/download, peer search/scope visibility, file/link sharing and own-post deletion.

## 4. Before going live — must do

1. **Secrets:** strong `JWT_SECRET`, `OTP_PEPPER` and `POSTGRES_PASSWORD` in `docker/.env` (`openssl rand -hex 32`).
2. **Super Admin password:** the current dev admin password is weak. Set a strong `SEED_ADMIN_PASSWORD` for prod and change it after first login.
3. **URLs:** `ALLOWED_ORIGINS` = admin panel HTTPS origin; admin `NEXT_PUBLIC_API_URL` and mobile `EXPO_PUBLIC_API_URL` = the HTTPS API URL.
4. **Email:** `BREVO_API_KEY` set and sender domain verified (production refuses to send OTPs without it).
5. **S3:** a separate production bucket (private, CORS for the admin origin). The dev bucket `myggitsdev` and the dev DB contain test data — don't reuse them.
6. **Permissions:** non–Super Admin accounts have no permissions until granted. Grant `MODERATE_PEER_RESOURCES` explicitly to each moderator.
7. **Assessment history:** confirm assessment data is no longer needed, or export/archive it before applying the migration.
8. **Mobile builds:** no native dependency was added for this restructure; an installed dev client with the existing Expo native modules can load the JavaScript update. Rebuild when native dependencies or native configuration change.
9. **Backups:** schedule `pg_dump` for the production DB.

## 5. Known caveats (by design / to decide)

- **Regex patterns** for enrollment numbers and institutional emails (`apps/backend/src/config/validation.ts`) must be confirmed against the real college data before the bulk import.
- **Account lookup** (`/auth/lookup`) reveals whether an enrollment number/email exists. This is inherent to the OTP-first login flow; it's rate-limited.
- Looking up a **pending staff** account from the mobile app still sends the OTP email (the app then tells them to use the admin panel).
- Existing Assessment/quiz data is intentionally not migrated into the new Academics modules.
- The old single `resumeUrl` was replaced by two resume fields; there was no data backfill (fine for a fresh production DB).
- Root `package.json` pins **TypeScript ~5.9.3** and **@babel/core ^7.29** for Next/Expo compatibility. The backend uses its own TypeScript 7. Keep these pins.

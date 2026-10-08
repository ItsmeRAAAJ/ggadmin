# Academics API — Deadlines, Resources, Share with Peers

All responses use the standard envelope `{ success, data?, message?, code? }`.
Auth: `Authorization: Bearer <session JWT>` (the web panel uses the httpOnly cookie).
Validation failures return **422** `VALIDATION_ERROR`; business-rule failures return 400/403/404/409/429 with a `code`.

Visibility rule for teacher-owned content (deadlines, resources) is the same as assignments:
a student sees subjects of **their branch + current semester** (section is ignored).

---

## 1. Deadlines

### Teacher (`/teacher`, role TEACHER — must be assigned to the subject)

| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/teacher/deadlines` | `?subjectId=&when=upcoming\|past\|all` (default `upcoming`) | Deadlines of the teacher's subjects. Each item has `subject`, `createdBy`, `isOwner`. |
| POST | `/teacher/deadlines` | `{ subjectId, title (1–200), description?, dueAt (ISO) }` | `dueAt` must be in the future (`DUE_IN_PAST`). |
| PATCH | `/teacher/deadlines/:id` | any of `{ title, description, dueAt }` | Any teacher of the subject can edit. |
| DELETE | `/teacher/deadlines/:id` | — | Any teacher of the subject can delete. |

### Student (`/me`, role STUDENT)

`GET /me/deadlines?when=upcoming|past|all` (default `upcoming`)

```json
{
  "timezone": "Asia/Kolkata",
  "items": [{ "id", "title", "description", "dueAt", "date": "2026-10-05", "daysLeft": 2, "isPast": false,
              "subject": { "id", "name", "code" }, "teacherName": "Prof X" }],
  "groups": [{ "date": "2026-10-05", "daysLeft": 2, "items": [ ... ] }]
}
```
`daysLeft` counts calendar days in IST: `0` = today, `1` = tomorrow, negative = past.

---

## 2. Resources (teacher folders → files)

Allowed file types (an allowlist): **pdf, png, jpg/jpeg, heic, pptx, docx, xlsx**, up to **25 MB**.
Files are stored privately in S3 under `subjects/{subjectId}/resources/{folderId}/{uuid}-{safeFilename}.{ext}` and served as short-lived signed URLs. The folder ID binds the object to the resource record; the original filename is reduced to a safe basename for readability. Existing keys without a filename suffix remain supported.

### Teacher

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/teacher/resources/subjects` | — | Teacher's subjects with `folderCount`, `fileCount`. |
| GET | `/teacher/subjects/:subjectId/resource-folders` | — | `{ subject, folders[{ id, name, order, fileCount, createdBy }] }` |
| POST | `/teacher/subjects/:subjectId/resource-folders` | `{ name (1–100, no slashes), order? }` | `409 FOLDER_EXISTS` on duplicate name. |
| GET | `/teacher/resource-folders/:id` | — | Folder + `subject` + `files[]` (signed `fileUrl`, `fileType`, `fileSize`). |
| PATCH | `/teacher/resource-folders/:id` | `{ name?, order? }` | Rename / reorder. |
| DELETE | `/teacher/resource-folders/:id` | — | Permanently deletes the exact S3 objects first, then the folder and file records. An S3 failure is returned and records are retained. |
| POST | `/teacher/resource-folders/:id/upload-url` | `{ fileName, fileType, fileSize }` | Returns `{ uploadUrl, fileUrl, key }`. PUT the bytes to `uploadUrl` with the same `Content-Type`. |
| POST | `/teacher/resource-folders/:id/files` | `{ title, fileUrl, fileName? }` | Confirms the upload (server HEAD-checks the object and records its size). |
| DELETE | `/teacher/resource-files/:id` | — | Permanently deletes the exact S3 object first, then the file row. An S3 failure is returned and the row is retained. |

### Student

| Method | Path | Notes |
|---|---|---|
| GET | `/me/subjects` | Current subjects with `folderCount`, `fileCount`. |
| GET | `/me/subjects/:subjectId/resources` | `{ subject, folders[{ id, name, order, fileCount }] }` — 404 if not the student's subject. |
| GET | `/me/resource-folders/:id` | `{ id, name, subject, files[{ id, title, fileName, fileSize, fileType, fileUrl (signed, 1 h), teacherName, createdAt }] }` |

---

## 3. Share with Peers

A post carries **either** a file **or** a link (never both).

Scopes, fixed from the uploader's profile when the post is created:

| Scope | Visible to |
|---|---|
| `CLASS` | same branch + semester + section (section compared case-insensitively). Requires the uploader's section to be set (`SECTION_NOT_SET`). |
| `BRANCH` | same branch, any semester |
| `SEMESTER` | same semester, any branch |

Uploaders always see their own posts. Categories: `PREVIOUS_YEAR_PAPER`, `LAB_MANUAL`, `REFERENCE_MATERIAL`, `USEFUL_LINK`, `CHEATSHEET`, `OTHER`.
Limit: 30 posts per student per 24 h (`429 PEER_DAILY_LIMIT`).

### Student

| Method | Path | Body / query |
|---|---|---|
| POST | `/me/peer-resources/upload-url` | `{ fileName, fileType, fileSize }` → `{ uploadUrl, fileUrl, key }` (same 25 MB allowlist; safe filename is included in the generated S3 key) |
| POST | `/me/peer-resources` | `{ title, description?, category, scope, subjectId?, fileUrl? + fileName?, linkUrl? }` |
| GET | `/me/peer-resources` | `?q=&category=&scope=&subjectId=&mine=true&page=1&limit=20` (max 50) |
| DELETE | `/me/peer-resources/:id` | Own posts only; removes an attached file from S3 before deleting its record. |

Feed response: `{ items, page, limit, hasMore }`. Item (card):

```json
{ "id", "title", "description", "category", "scope", "kind": "FILE|LINK",
  "fileUrl": "signed|null", "fileName", "fileSize", "fileType": "pdf|null", "linkUrl",
  "subject": { "id", "name", "code" } | null, "createdAt", "isMine": true,
  "uploader": { "name", "avatarUrl", "branch": "CSE", "semester": 5 } }
```
Email and enrollment number are never exposed.

### Moderation — ADMIN or TEACHER with `MODERATE_PEER_RESOURCES` (super admin always)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/peer-resources` | `?q=&category=&scope=&branchId=&semester=&page=&limit=` → `{ items, total, page, limit, hasMore }` (items also carry `scopeSemester`, `scopeSection`) |
| DELETE | `/admin/peer-resources/:id` | Removes an attached file from S3 before deleting the post; S3 errors are surfaced and the post remains. Writes audit log `PEER_RESOURCE_REMOVED` after deletion. |

Grant the permission from **Admin → Permissions** (to an admin) or to a teacher (admin or their HOD/Incharge).

All these files stay private; returned download links are short-lived signed URLs, not public object URLs. Re-fetch the relevant API response after a link expires. See [`RUNBOOK.md`](RUNBOOK.md#s3-object-layout-and-deletion) for the full key layout, legacy-object compatibility and versioned-bucket delete permissions.

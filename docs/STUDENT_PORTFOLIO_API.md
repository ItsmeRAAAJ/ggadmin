# Placement Cell API — complete student profiles, branch-wise

Read-only JSON endpoints for the placement cell (or any frontend) to fetch **complete** student
profiles per branch — photo, contact, academics, resumes, certificates, projects, achievements and
social links — for sharing with HR / companies.

## Access

| Requirement | Detail |
|---|---|
| Auth | Admin session token: `Authorization: Bearer <token>` (or the admin panel's `__session` cookie) |
| Role | `ADMIN` (students/teachers get `403`) |
| Permission | `EXPORT_STUDENT_PROFILES` (super admin has it; grant it to a "Placement" admin from the panel) |
| Field masking | Email is masked unless the caller has `VIEW_STUDENT_EMAIL`; phone unless `VIEW_STUDENT_MOBILE_NUMBER` |
| Audit | Every call writes an `AuditLog` row (`VIEW_PLACEMENT_PROFILES` / `VIEW_PLACEMENT_PROFILE`) |
| Caching | `Cache-Control: no-store` |

Get a token:

```bash
curl -X POST http://localhost:3001/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"admin@ggits.org","password":"<password>"}'
# → { "success": true, "token": "eyJ...", "role": "ADMIN" }
```

**Browser frontends on another domain:** add that origin to the backend's `ALLOWED_ORIGINS`
(comma-separated) or the browser will block the requests (CORS). Server-to-server calls aren't affected.

**File links** (`profileImageUrl`, resumes, certificate/achievement `fileUrl`) are pre-signed S3 URLs
valid for `linksExpireInSeconds` (1 hour). Re-fetch the endpoint to get fresh links; don't store them.
The bucket remains private. If a newly fetched link still fails, confirm the referenced object exists and that the backend is using the correct bucket, region and read permissions. Existing object URLs/keys continue to work; no user re-upload or key migration is required. Replacing or deleting a profile file first deletes the exact S3 object (including versions in versioned buckets); failures are returned without removing its database record.

## Endpoints

### 1. `GET /admin/portfolio/branches`

All branches with student counts.

| Query | Default | Values |
|---|---|---|
| `status` | `ACTIVE` | `ACTIVE`, `PENDING_ACTIVATION`, `DISABLED`, `ALL` |

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "cmus38yul…", "shortCode": "IOTCSBT", "name": "Internet of Things, Cyber Security & Blockchain Technology", "studentCount": 29 }
    ],
    "total": 9
  }
}
```

### 2. `GET /admin/portfolio/branches/:branchCode/students`

Complete profiles for one branch, paginated. `:branchCode` is the branch short code (case-insensitive,
e.g. `IOTCSBT`) or the branch id.

| Query | Default | Notes |
|---|---|---|
| `status` | `ACTIVE` | `ACTIVE` = students who completed onboarding. Use `ALL` to include everyone |
| `page` | `1` | |
| `limit` | `50` | max `100` |
| `passoutYear`, `admissionYear`, `currentSemester` | — | integers |
| `section` | — | case-insensitive |
| `search` | — | matches enrollment number, first or last name |

Ordered by passout year, then enrollment number.

```json
{
  "success": true,
  "data": {
    "branch": { "id": "…", "shortCode": "IOTCSBT", "name": "Internet of Things, Cyber Security & Blockchain Technology" },
    "items": [
      {
        "id": "cmus3bz0z…",
        "userId": "cmus3bz0y…",
        "enrollmentNumber": "0206IS241054",
        "status": "ACTIVE",
        "firstName": "Shubhashish",
        "lastName": "Chakraborty",
        "fullName": "Shubhashish Chakraborty",
        "email": "student@ggits.net",
        "phone": "98XXXXXXXX",
        "dateOfBirth": "2006-07-14T00:00:00.000Z",
        "profileImageUrl": "https://<bucket>.s3.ap-south-1.amazonaws.com/…?X-Amz-Signature=…",
        "academic": {
          "branch": { "id": "…", "shortCode": "IOTCSBT", "name": "…" },
          "admissionYear": 2024, "passoutYear": 2028, "currentSemester": 5, "section": "A"
        },
        "resumes": { "tech": "https://…signed", "nonTech": null },
        "links": { "linkedin": "https://linkedin.com/in/…", "github": "https://github.com/…", "portfolio": null },
        "socialLinks": [{ "id": "…", "platform": "GITHUB", "url": "https://github.com/…" }],
        "certificates": [{ "id": "…", "title": "AWS Cloud Practitioner", "issuer": "AWS", "issueDate": "2025-05-01T00:00:00.000Z", "fileUrl": "https://…signed", "createdAt": "…" }],
        "projects": [{ "id": "…", "title": "Smart Parking", "description": "…", "techStack": ["ESP32", "React"], "link": "https://…", "startDate": "…", "endDate": null, "createdAt": "…" }],
        "achievements": [{ "id": "…", "title": "Hackathon winner", "description": "…", "category": "CO_CURRICULAR", "date": "…", "fileUrl": null, "createdAt": "…" }],
        "counts": { "certificates": 1, "projects": 1, "achievements": 1 },
        "joinedAt": "…",
        "updatedAt": "…"
      }
    ],
    "total": 29,
    "page": 1,
    "limit": 50,
    "totalPages": 1,
    "visibility": { "email": true, "phone": true },
    "linksExpireInSeconds": 3600
  }
}
```

### 3. `GET /admin/portfolio/students/:id`

One complete profile ("View Full Profile"). `:id` is the student profile id **or** the enrollment
number. Returns the same object as a list item, plus `visibility` and `linksExpireInSeconds`.

## Errors

| Status | `code` | When |
|---|---|---|
| 400 | `INVALID_STATUS` | Unknown `status` value |
| 401 | `UNAUTHENTICATED` / `INVALID_TOKEN` | Missing/expired token |
| 403 | `FORBIDDEN` | Not an admin, or missing `EXPORT_STUDENT_PROFILES` |
| 404 | `NOT_FOUND` | Unknown branch / student |

## Example

```bash
TOKEN=…   # from /auth/login
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/admin/placement/branches
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3001/admin/placement/branches/IOTCSBT/students?passoutYear=2028&limit=100"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/admin/placement/students/0206IS241054
```

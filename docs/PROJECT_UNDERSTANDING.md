# Project Understanding & Breakdown — Master Doc

**App name:** My GGITS
**Institution:** Gyan Ganga Institute of Technology & Sciences (GGITS), Jabalpur
**Lead Developer:** Shubhashish Chakraborty
**Document type:** This is the **master, evergreen reference** for what this system is and how it works — architecture and product decisions only, not a build log or a progress snapshot. When scope changes, this doc is edited in place to reflect the new current understanding; it does not accumulate "old vs. new" history.

---

## 1. What this project is

A college-wide platform for every GGITS student — 1st semester through 8th semester, every branch — covering two things at once:

1. **A living student profile & portfolio system.** Students manage their professional profile (resume, certificates, projects, achievements, links, etc..) continuously from day one of college, not as a one-time pre-placement form.
2. **An academic layer on top of that identity**, unified under a single **Academics** tab in the app — subject-scoped assignments (homework), teacher-managed subject resources, academic deadline reminders, and peer-to-peer resource sharing among students, all sitting on the same student/branch/subject data model. (Online auto-graded quizzes/assessments were built in an earlier round, then deliberately removed — see §3.5.)

It replaces the college's old manual placement workflow entirely:
- Previously: TPO released a Google Form per batch around 5th semester, pulled into a Next.js "TPO portal" via the Google Sheets API — static, one-time, and requiring manual codebase changes for every new batch.
- Now: every student has an account and a living profile from the start; the system is fully data-driven (branch, batch/admission year, semester are just fields — never hardcoded logic); TPO/admin/college management get a real dashboard instead of a spreadsheet, with export retained for company/HR sharing.

This is a real institutional system, not a prototype — build and maintain it at that standard.

---

## 2. Stakeholders

| Stakeholder | What they need from the app |
|---|---|
| **Students** (all 8 semesters, all branches) | Manage their own profile/portfolio continuously; submit assignments; track deadlines; share/browse peer resources; no signup friction |
| **Subject Teachers** | Create assignments, deadlines, and manage subject resource folders for subjects they're assigned to; grade their own subject's submissions |
| **Incharge** (teacher tier) | Everything a Subject Teacher can do, plus manage Subject Teachers below them |
| **HOD** (teacher tier) | Everything an Incharge can do, plus manage Incharges and the department's teaching assignments overall |
| **Admins** (Super Admin, TPO, and any future admin type) | Seed/manage student data; manage the admin hierarchy and permission grants; export data for placements |
| **College Management** (Dean, Principal) | Own the system at the institutional level; reviewed and approved the build in stages |

---

## 3. Core architecture decisions

### 3.1 No self-signup

Students never "register." Their basic identity (enrollment number + institutional email) is **pre-seeded into the database by the SUPERADMIN/college management**, sourced from officially generated university data (CSV/JSON upload via the admin web panel, or manual single-student add). A student's first interaction with the app is *logging in*, not *signing up* — the account exists in a `PENDING_ACTIVATION` state until the student completes login + OTP + password creation.

This guarantees every account maps to a real enrolled student, matches how the TPO office already thinks about data ownership, and keeps admin in control of *who exists* while students control *what's in their profile*.

**Known data formats:**
- **Enrollment number**: `<4-digit code><2-letter branch code><2-digit admission year><4-digit serial>` — e.g. `0206IS241034`.
- **Institutional email**: `firstname.lastname.<branchcode><year>@ggits.net` — e.g. `utkarsh.trivedi.is24@ggits.net`.
- **Confirmed branch codes**: CS, IS, EC, ME, CE, EE, CSEAIML, CSEIOT, CSEDC.

### IMP for Initial DATA SEED
**Bulk/manual seeding is additive and non-destructive, always.** Re-uploading a CSV with new students on top of an existing set only adds the new ones — existing records are never overwritten or removed. A record already **activated** by its student is fully protected from any re-upload touching its identity fields. A record still `PENDING_ACTIVATION` can have its seed-level fields (branch, email, admission year) corrected by a re-upload, since the student hasn't started using it yet. Manual single-student add goes through the exact same validation/upsert logic as bulk upload, so the two paths never behave differently. Every upload — bulk or single — returns a per-row outcome (inserted / updated / skipped-protected / invalid-format), never a single pass/fail.

### 3.2 Admin hierarchy + universal permission system

A single flat `ADMIN` role isn't sufficient for how this system is actually governed, so admin access is modeled as a hierarchy with grantable, revocable permissions:

- **Admin hierarchy**: every admin optionally has a parent admin — whoever created/manages them. The Super Admin has no parent and sits above the entire system. Admin 2 reports to Admin 1; Admin 3 might report to Admin 2. An admin can manage (grant/revoke permissions to, and see) anyone below them in this tree, but never a peer or an ancestor.
- **The global permission master list**: a single table of every grantable capability in the system (e.g. `VIEW_STUDENT_MARKS`, `VIEW_STUDENT_MOBILE_NUMBER`, `MANAGE_TEACHER_ASSIGNMENTS`), each with a stable key, a human-readable label, and a category (admin-management, student-data-field visibility, teacher capabilities, assessment/marks). This one list backs **both** admin-to-admin grants and admin/HOD/Incharge-to-teacher grants — it's a single unified system, not two separate ones.
- **Grants are per-person**, not just per-role. An admin can grant or revoke any permission from the master list to a specific person below them — this is what makes "give a teacher visibility into marks, then take it away later" a checkbox toggle rather than a code change.
- **Important nuance**: the master list being admin-editable (new entries addable without a schema migration) only controls which *already-coded* checks are toggled on or off for whom. A brand-new capability still needs a developer to write the actual enforcement check somewhere in the API before toggling it does anything.
- **Admin/teacher login uses a role-category selector**: the login screen presents a dropdown of "who am I" (fetched live from the admin role list, plus a fixed "Teacher" option) before credentials. This is a clarity/UX feature — actual authorization is still enforced by role/permission middleware regardless of what was selected, and the dropdown updates automatically as new admin types are added, with no frontend code change required.

### 3.3 Teacher hierarchy & scoped student-data access

Teaching staff form their own hierarchy, separate from the admin hierarchy: **Admin → HOD → Incharge → Subject Teacher.** HODs and Incharges are still teachers (they hold the same profile type, and may teach subjects themselves) — they simply also have oversight of the teachers below them. This keeps them inside the teacher data model rather than treating them as IT-administrative accounts, since they're fundamentally faculty.

An HOD/Incharge can create and manage subject-teacher assignments for the teachers below them, scoped to their own branch — this is the mechanism that stops, for example, an AIML-branch teacher from ever being assigned to or seeing IoT-branch students.

Separately from subject/section assignment, admins (or an HOD, if granted the capability) control **which student profile fields** a teacher can see at all — starting minimally (enrollment number, name) and extendable via the same permission-grant mechanism.

### 3.4 Marks visibility — confirmed, strict by default

**Students never see their marks in this system** — no student-facing endpoint exposes a score for graded assignment work. **Teachers can grade and see marks only for their own subject's submissions** — that's a baseline part of doing their job and isn't gated. Any visibility into a student's marks **outside the subjects a teacher actually teaches** (e.g. a cross-subject marks report) is gated behind the `VIEW_STUDENT_MARKS` permission, off by default, grantable by an admin.

### 3.5 Academic layer: the Academics tab, the resource ecosystem, and why quizzes were removed

An earlier round of this system built a full online quiz/test feature (MCQ questions, auto-grading, timed attempts). **That feature has been removed entirely.** Once a quiz is taken unsupervised on a student's own device, there's no meaningful way to stop an AI tool from answering it for them — which makes an unproctored, auto-graded online quiz pointless as a real assessment of learning. Rather than keep a feature nobody can trust the results of, it was cut. This is a deliberate product decision, not a bug or an oversight — if an in-person/proctored assessment mode is ever wanted again, it needs to be designed as a genuinely different feature (proctored, in-classroom-only), not a revival of the original online version.

In its place, everything academic that isn't profile/portfolio lives under a single top-level **Academics** tab (chosen over "Classroom" — it reads less teacher-owned, since this tab holds both teacher-managed and student-managed content, and stays generic enough to absorb future additions like a PYQ section, study groups, or Q&A without feeling mismatched). Anything added to this space later should default to becoming a new section within this tab rather than a new top-level nav item. The tab currently holds four distinct sections:

- **Assignments** (unchanged from before) — teacher-created homework with a due date and file submission; pending/submitted/late tracking on the teacher side.
- **Deadlines** — a lightweight, teacher-posted reminder system, separate from Assignments. A teacher announces a date (e.g. "practical notebook submission," "project report due") with no per-student submission tracking attached — this solves the real problem of students who miss an in-class announcement having no way to find out later. Shown to students as a simple date-grouped timeline.
- **Resources** — teacher-managed, official subject material, organized as subject → named folders (e.g. "Unit 1," "Previous Year Papers," "Lab Material") → files. This is the authoritative, teacher-curated material for a subject.
- **Share with Peers** — a separate, student-driven resource-sharing feed (previous-year papers, lab manuals, reference material, useful links, cheatsheets, and similar document types — not video/audio). Each upload has a **scope** the uploader chooses (their class/section, their branch, or their semester), and the feed is deliberately social/browsable (clear uploader identity, clean cards, search) — kept distinct from the teacher-curated Resources section above, since the two serve different trust levels: official material vs. peer-shared material.

---

## 4. High-level user flows

### 4.1 Admin seeding flow
Admin/TPO/college management logs into the web admin panel, uploads a CSV/JSON of official student records (enrollment number, institutional email, branch, admission year), or adds a single student manually. Records are inserted or updated per the non-destructive upsert rules in §3.1, becoming eligible for student login/activation.

### 4.2 Student first-login / onboarding flow
Student enters their enrollment number or institutional email → backend checks against pre-seeded records → if found, an OTP is emailed via Brevo → student enters OTP, verified immediately → short onboarding to set a password → lands on Home. Subsequent logins use identifier + password; OTP is reserved for first login and password reset. Magic links are deferred to future scope.

### 4.3 Profile management flow (ongoing, any time)
Student manages: profile photo, **two separate resumes** (technical and non-technical), certificates, projects/work, achievements (categorized as Academic / Co-Curricular / Extra-Curricular), and social/portfolio links — all files via presigned S3 uploads, only URLs/metadata in Postgres. Designed to be edited repeatedly across all 8 semesters.

### 4.4 Admin hierarchy & permission management flow
An admin who is an ancestor of another admin (or the Super Admin, unconditionally) can create new admins beneath themselves and grant/revoke individual permissions from the master list via simple checkbox toggles in the admin panel — each toggle takes effect immediately, no separate save step. The same grant/revoke mechanism applies when an admin, HOD, or Incharge extends specific capabilities to a teacher below them.

### 4.5 Teacher hierarchy flow
An HOD assigns Incharges and subject teachers within their branch; an Incharge assigns subject teachers within their own scope. Each assignment is what actually grants a teacher visibility into a subject/section's students — the hierarchy governs *who is allowed to create that assignment for whom*, not the visibility itself.

### 4.6 Teacher assignment (homework) flow
A subject teacher creates an Assignment (under the Academics tab) for a subject they teach, with a description and due date. Students submit their work (file upload) before the deadline; submissions after the deadline are tracked as late rather than rejected. The teacher's dashboard shows a pending/submitted/late breakdown per assignment. The teacher grades their own assignment's submissions directly — no permission gate on that.

### 4.7 Academic deadline/reminder flow
A subject teacher posts a Deadline (title, optional description, due date) for a subject they teach. Students see all their relevant deadlines as a single date-grouped timeline under the Academics tab, regardless of whether they were physically present when it was announced in class. No submission tracking is attached — purely informational, maintained manually by the teacher otherwise.

### 4.8 Teacher resource management flow
A subject teacher organizes official material for a subject they teach into named folders (e.g. "Unit 1," "Previous Year Papers") and uploads files into them. Students browse a subject's Resources section read-only, folder by folder.

### 4.9 Peer resource sharing flow
A student uploads a file (PDF, image, PPTX, or similar document type — not video/audio) or a link, tags it with a category (previous-year paper, lab manual, reference material, useful link, cheatsheet, etc.), and chooses a sharing scope — their class, their branch, or their semester. Other students within that scope can browse, search, and open/download it. Students can remove their own uploads.

### 4.10 TPO/placement export flow
TPO/admin views all student profiles filtered by branch/batch/semester and exports to CSV/Excel for sharing with recruiting companies — the one workflow already proven to work well, carried forward unchanged.

---

## 5. Feature set

### Student-facing
- Profile management: personal details, dual resumes (tech/non-tech), certificates, projects, achievements (categorized), social links, profile photo
- Academics tab: assignment submission (tracked pending/submitted/late), a date-grouped deadline timeline, browsing teacher-curated subject Resources, and browsing/searching/uploading to the peer resource-sharing feed (scoped to class/branch/semester)

### Teacher-facing
- Subject-scoped assignment creation and grading
- Subject-scoped deadline posting
- Subject Resource folder management (create folders, upload official material)
- (HOD/Incharge only) managing teacher assignments within their scope

### Admin-facing
- Student seeding (bulk CSV/JSON, non-destructive) and manual single-add
- Student filtering, viewing, and CSV export for placements
- Branch, subject, and teacher-subject-assignment management
- Admin hierarchy management: creating admins beneath oneself, managing the permission master list, granting/revoking permissions to admins and teachers
- Audit log of key actions (seeding, exports, permission grants/revokes)
- Role-category login selection

### Explicitly deferred (not being built right now)
- Magic-link / passwordless login
- Push notifications
- Redis or any caching layer — no usage data has justified it yet
- Play Store publishing
- Dark mode — light mode only, by design
- Online auto-graded quizzes/assessments — built once, then deliberately removed (see §3.5); not coming back in its original unproctored form
- Dedicated PYQ (previous-year-questions) section, study groups, and a Reddit/Twitter-style Q&A feature — named as likely future additions to the Academics tab, not yet scoped
- Anything beyond the above academic layer (attendance, fees, library, etc.) — future roadmap, not in scope now

---

## 6. Tech stack & repo structure

| Layer | Choice |
|---|---|
| Mobile app (student-facing) | React Native + Expo, TypeScript |
| Admin/Teacher web panel | Next.js, TypeScript |
| Backend API | Node.js + Express, TypeScript |
| ORM / Database | Prisma + PostgreSQL (self-hosted in Docker on the same VPS) |
| File storage | AWS S3 (Mumbai region) |
| Email / OTP delivery | Brevo (transactional email) |
| Hosting | Hostinger VPS (KVM 2), Docker Compose |
| Repo structure | Monorepo (Turborepo + pnpm workspaces): `apps/backend`, `apps/admin-panel`, `apps/mobile`, `packages/shared` (Zod schemas, shared TS types, validation regex, constants used by all three apps) |
| Caching | Deliberately none |

Full schema, API surface, and Docker setup live in `TECHNICAL_PLAN.md`. Anything still pending implementation is tracked in `CONTINUE_BUILD_BACKEND.md` / `CONTINUE_BUILD_FRONTEND.md`.

---

## 7. Roles & permissions summary

| Role | Baseline capability | Extendable via permission grants? |
|---|---|---|
| **Student** | View/edit own profile; submit assignments; share/browse peer resources | No — never a grant target |
| **Subject Teacher** | Manage assignments, deadlines, and resources for assigned subjects; grade own subject's submissions | Yes — field visibility, cross-subject marks visibility, etc. |
| **Incharge** | Everything a Subject Teacher can, plus manage Subject Teachers below them | Yes |
| **HOD** | Everything an Incharge can, plus manage Incharges and department-wide assignments | Yes |
| **Admin (any type, e.g. TPO)** | Seed/manage students, export data — exact scope depends on grants | Yes — including managing admins below them |
| **Super Admin** | Everything, unconditionally, for everyone | N/A — sits above the grant system entirely |

---

## 8. Branding

- **Name:** My GGITS
- **Theme:** light mode only.

| Token | Hex | Source / use |
|---|---|---|
| Primary — Gold/Amber | `#F0A83E` | GGITS logo's outer gear ring — primary brand/action color |
| Secondary — Forest Green | `#4C7A3D` | GGITS logo's laurel wreath — secondary accent, success states |
| Text — Charcoal | `#1c1c1c` | Primary text |
| Surface — Light gray | `#f2f3f4` | Screen backgrounds |
| Surface — White | `#ffffff` | Cards, elevated surfaces |

Full design tokens (states, shadows, typography) are in `TECHNICAL_PLAN.md` §10.

---

## 9. Non-functional context

- **Scale**: ~10,000 students college-wide is well within a single Hostinger KVM 2 VPS for CRUD-style traffic — no premature horizontal scaling, caching, or managed cloud is warranted.
- **Cost**: recurring cost is effectively the VPS already in use, plus negligible S3 storage (~₹100–200/month at this scale) and a free-tier Brevo account. No SMS/DLT cost, since auth is email-only.
- **Backups**: automated Postgres backups (to S3) are a standing requirement, not optional polish — this system holds PII, academic records, and marks for the whole college.
- **Data sensitivity & audit**: RBAC, audit logging on admin/permission actions, and a clear data-retention stance are core requirements of this system, not later hardening. Every permission grant/revoke, every seeding action, and every data export is expected to leave an audit trail.
# My GGITS — Real-life operating guide

This guide describes how the currently implemented My GGITS app is used in a college setting, from first deployment and staff setup through student activation, semester-by-semester use, placement exports, and routine administration. It is written for the people operating the system as well as the students and teachers using it and the developers as well.

My GGITS has three user experiences:

| Experience    | Users                                                | Main purpose                                                                                                                                                                   |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin panel   | Super Admin, delegated admins, TPO / placement staff | Set up the institution, prepare student accounts, manage staff and permissions, oversee data, and export placement profiles.                                                   |
| Teacher panel | Subject teachers, Incharges, HODs                    | Work with assigned subjects, publish assignments and deadlines, manage course resources, and review submissions. HODs and Incharges can also manage eligible staff below them. |
| Mobile app    | Students                                             | Maintain a student-owned profile and portfolio, follow academics, submit assignments, and share/browse study material with peers.                                              |

The system does **not** have student self-registration. The college creates a student's account from official enrollment information; the student then verifies their institutional email and activates that account. A student's academic identity (enrollment number, branch, admission year, semester and section) is college-managed. Their personal profile and portfolio are student-managed.

## 1. The people and the two hierarchies

There are two separate organizational trees. They are not interchangeable.

### Administrator tree

The Super Admin is the root. When an admin creates another admin, the new admin's **parent is automatically set to the creating admin**. That creates an administrator parent/child tree such as:

```text
Super Admin
└── TPO administrator
    ├── Placement coordinator
    └── Data-entry administrator
```

The admin list and detail pages are scoped to the signed-in administrator and their descendants. An admin may manage people below them, not peers or ancestors. The Super Admin can oversee all administrators. Admin account creation requires `MANAGE_ADMIN_HIERARCHY`; only a Super Admin can assign the `SUPERADMIN` role.

### Teacher tree

Faculty are teacher accounts, not admin accounts. An administrator creates each teacher and selects a tier, primary branch, and optional **Reports to** teacher. The reporting line is a separate tree:

```text
Admin creates the faculty accounts
└── HOD
    └── Incharge
        └── Subject Teachers
```

`reportsTo` establishes who is above whom for team management. An HOD/Incharge may view/manage descendants only, and needs `MANAGE_TEACHER_ASSIGNMENTS` to assign or unassign subjects for staff below them. This permission is granted by default to new HOD and Incharge accounts; a Subject Teacher receives `CREATE_ASSIGNMENT` by default. These defaults can be revoked or supplemented by an authorized administrator.

For HOD/Incharge self-service assignment, the subject must be in the teacher's scope: their primary branch's subjects, plus subjects they already teach. An administrator using the central **Teacher assignments** screen assigns a teacher to a subject, optional section and academic year, subject to their permission. Assignment to a subject is what allows the teacher to manage its assignments, deadlines and resources; a reporting relationship by itself does not grant access to every subject.

### Roles are not the same as permissions

- A teacher's tier (`HOD`, `INCHARGE`, `SUBJECT_TEACHER`) describes their position and determines some defaults and hierarchy behavior.
- An admin role type (for example, `TPO`) is primarily an admin **login category**. It does not, by itself, grant the corresponding admin-management capabilities.
- Individual permission grants control access to protected admin and teacher actions. The backend checks them; hiding a button in the panel is not the security boundary.
- The Super Admin is special: it has every permission in the current permission master list.
- A person can only grant/revoke permissions they themselves hold. Admins can manage grants only for admins beneath them. Teachers who hold the applicable capability may grant eligible teacher permissions to descendants.
- Adding a new permission in **Admin roles → Permissions** only creates metadata. It does not make a new feature work until code enforces that permission.

## 2. Before students arrive: institutional setup

### Step 1 — Deploy and protect the system

The technical deployment process is in [`RUNBOOK.md`](RUNBOOK.md). In production, the college/operator should:

1. Deploy the backend, PostgreSQL database, admin panel and student mobile app with production environment configuration.
2. Configure transactional email (Brevo) so activation and password-reset codes reach institutional inboxes.
3. Configure the private S3 bucket, CORS for upload origins, and least-privilege backend credentials. Uploaded files are private and returned to users through expiring signed URLs.
4. Set a strong Super Admin password and verify the first login. Do not use development credentials or development data for a live institution.
5. Arrange protected database backups and decide who handles account/email/academic-data corrections and support requests.

### Step 2 — Sign in as Super Admin and plan access

The initial Super Admin is created by the seed process. Sign in to the web panel using the category matching the admin role, then change the initial password. The role-category selector identifies which type of account is signing in; permissions still determine actual access.

Agree on the institutional responsibility structure before creating accounts. For each staff account, decide:

- Who the person's parent/manager is (administrator parent or teacher `Reports to`, as appropriate).
- Which role type or teacher tier they should receive.
- Which branch they oversee, if applicable.
- Which exact permissions their work requires.

Give each person only the data and management access necessary for their job. A TPO usually needs student-profile export; a data-entry operator may need student management and directory access; a department HOD may need a branch-scoped teacher team and assignment capability. These are examples, not automatic role grants.

### Step 3 — Verify branches and create the subject catalogue

The database is seeded with the branches configured by the project. Before importing students, use **Admin → Branches** to check the current branch codes and names. Student import branch codes must match an existing branch code. If the college has a branch not present in the list, an authorized administrator adds it before import.

Create the curriculum in **Admin → Subjects**. Each subject needs a unique code, name, branch and semester. Repeat for the subject offerings students and teachers actually need. The subject catalogue drives student visibility and teacher resource/assignment placement; accurate branch and semester values matter.

### Step 4 — Create the administrator team

In **Admin → Admins**, a Super Admin or an authorized admin with `MANAGE_ADMIN_HIERARCHY` creates a child admin by providing their name, email and role type. The new account starts in `PENDING_ACTIVATION`; its parent is set to the admin who created it.

Open the new admin's detail and grant individual permissions from the permission list. An admin only receives permissions held by the granting admin, so permission delegation cannot be used to escalate access beyond the grantor's own access. Confirm the recipient's parent, role and required permissions before they begin using the panel.

Use **Admin → Admin roles** to maintain role types shown on the admin login screen. In the current implementation, only the Super Admin can create or rename role types. Changing a role's label does not change its permissions.

### Step 5 — Create faculty and establish the teaching tree

In **Admin → Teachers**, an admin with `MANAGE_TEACHERS` creates each staff account with:

- Staff email and name (plus optional department).
- Tier: HOD, Incharge or Subject Teacher.
- Primary branch (optional for the teacher profile, but important for HOD/Incharge subject scope).
- `Reports to` teacher (optional; use it to attach the teacher under the right HOD/Incharge).

New teacher accounts also start in `PENDING_ACTIVATION`. They receive the tier's default permission grants described above. Review the staff profile, status, hierarchy and permissions; then add any justified grants. Admins may change teacher details, tier, primary branch and reporting line later. Avoid creating circular reporting relationships.

There are two ways to attach a teacher to a subject:

1. An authorized administrator uses **Admin → Teacher assignments** to map teacher + subject + optional section + academic year.
2. An HOD/Incharge with `MANAGE_TEACHER_ASSIGNMENTS` uses **Teacher → Hierarchy** to assign a subject to a descendant, within their scope.

Choose the right route according to the college's operating responsibility. Keep academic year and section current. An unassigned teacher will not see that subject as an available teaching subject.

## 3. Importing students from official records

Only seed students from the college's verified enrollment register. In **Admin → Students → Import students**, upload a CSV with a header row. The current panel accepts up to **5,000 rows per request** and previews the CSV before submission.

Recommended CSV columns:

```csv
enrollmentNumber,email,branchCode,admissionYear,passoutYear,currentSemester,section
0206IS241034,first.last.is24@ggits.net,IS,2024,2028,3,A
```

`passoutYear`, `currentSemester` and `section` are optional. If passout year is omitted, the system assumes admission year + four. Validate enrollment numbers, email spelling, branch codes and section values with the institution before importing. Enrollment number format is four digits + two letters + two digits + four digits (for example, `0206IS241034`). Institutional email validation follows the configured college format/allowlist in the backend; it is not an arbitrary personal-email import tool.

After preview, upload the CSV and review the row-by-row result:

| Result              | What happened                                                                                 | Operator action                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `inserted`          | A new student user and profile were created in `PENDING_ACTIVATION`.                          | Tell the student which institutional email to use and how to activate.                             |
| `updated`           | A matching, still-pending student account was corrected from this row.                        | Check that the corrected identity/academic data is now right.                                      |
| `skipped-protected` | The enrollment number already belongs to an activated or otherwise protected student account. | Do not try to overwrite it through import; review through the approved support/correction process. |
| `invalid`           | The row failed validation, branch lookup or uniqueness checks.                                | Correct the row's reason, then upload the corrected row/file.                                      |

Import is additive and non-destructive. It does not remove students omitted from a later CSV. Pending accounts can have seeded fields corrected; activated/disabled accounts are protected from re-import changes. Fix all invalid rows and reconcile totals before inviting a cohort.

For one-off correction/addition, **Add student** uses the same validation and seed behavior. It is not a route to overwrite an activated account.

### Set semester, section and account status

The student directory supports search and filtering by branch, semester, status and admission year. Open a student for details and update semester or section when required. **Bulk semester** moves a selected branch/admission-year cohort together; confirm the target cohort and semester before applying it.

The account statuses mean:

- `PENDING_ACTIVATION`: the college record exists, but the person has not completed first login.
- `ACTIVE`: the person activated and can sign in.
- `DISABLED`: access is blocked. Re-enabling an account requires the account to have an established password.

Student academic fields are administrator-managed. The student can edit personal details but cannot change their own branch, admission year, semester, section or enrollment identity. There is no normal student-delete workflow in the current panel.

## 4. Staff/student activation and sign-in

### Staff first activation

The admin creates the teacher/admin record first. The staff member opens the web panel's **Activate** page and enters the same email address entered by the admin. They:

1. Request a one-time activation code sent to that account's email.
2. Enter the 6-digit code.
3. Set and confirm a password (minimum 8 characters with uppercase, lowercase and a number).
4. Sign in to the web panel, selecting **Teacher** or their assigned admin role category.

If an email is wrong or unavailable, an administrator should correct the account record before activation. OTPs expire, have a resend cooldown and hourly cap, and are limited to five verification attempts. A disabled account must be re-enabled by an administrator.

### Student first activation

Students install/open the My GGITS mobile app and use the college-provided enrollment number or institutional email:

1. The app checks for the pre-seeded account.
2. For a pending account, the backend sends an OTP to the registered email and displays a masked destination.
3. The student enters the 6-digit OTP and creates a password.
4. The account changes to `ACTIVE`, and the student enters the app.

Students who have not received the code should check that the email exists and is correct in the official student record, then contact their department office. They should not create a second account. Subsequent sign-in uses the identifier and password. Password reset uses an emailed OTP; changing the password from security settings requires the current password and signs out other sessions.

Admin and teacher accounts use the web panel. Student accounts use the mobile app. The client role selector helps route users but does not grant privileges.

## 5. Student day-to-day use

### Home and profile

The mobile **Home** tab is the student's dashboard: it shows profile completeness, pending assignments and upcoming deadlines. Refresh to fetch current information.

In **Profile**, students can maintain:

- Personal details: first/last name, phone, date of birth and profile photo.
- Two separate PDF resumes: technical and non-technical.
- Certificates with title, issuer, issue date and a supporting file.
- Projects with description, technology stack, link and dates.
- Achievements categorized as Academic, Co-curricular or Extra-curricular, optionally with supporting evidence.
- Social links.
- Account security: password change, sign out, and sign out everywhere.

Students may change their own portfolio; college-managed academic identity fields are read-only. Uploads go directly to the private S3 bucket through short-lived presigned upload URLs. A displayed file link is temporary and should not be bookmarked as a permanent link.

### Academics

The **Academics** tab contains four distinct areas:

1. **Assignments** — assignments for subjects in the student's branch and current semester. The student opens one, reads instructions and uploads a file before/after the due date. Late submissions are accepted and marked late. Students may replace a submission until it is graded; after grading it is locked. Students do not see marks/feedback in the student app.
2. **Deadlines** — a timeline of teacher-posted reminders such as practical-file, lab-record or project-report dates. These are reminders only; there is no submission tracker attached.
3. **Resources** — read-only official files organized as subject → folder → file by teachers.
4. **Share with Peers** — browse/search student-shared files and links, filter by category/scope/subject, and open a post within the visibility rules below.

The academic visibility rule is branch + current semester for assignments, deadlines and resources (section is ignored). Students whose semester/branch is incorrect should contact the department to update their record.

### Sharing with peers

A peer post is either a file or a link. A student chooses a title, optional description, category, optional subject and audience:

| Audience | Who can see it                                                                     |
| -------- | ---------------------------------------------------------------------------------- |
| Class    | Same branch, current semester and section; the student's section must be recorded. |
| Branch   | Students in the same branch, any semester.                                         |
| Semester | Students in the same semester, any branch.                                         |

Post categories include previous-year paper, lab manual, reference material, useful link, cheatsheet and other. File sharing accepts the configured document/image/spreadsheet/presentation formats up to 25 MB. The limit is 30 posts per student in a rolling 24-hour period. The student can delete their own post; a moderator may remove any post under moderation policy. An attached file is deleted from S3 when the post is deleted.

## 6. Teacher day-to-day use

After activation, a teacher signs into the web panel as **Teacher**. The teacher dashboard summarizes assigned subjects, resources, assignment states, ungraded submissions, upcoming deadlines and team size.

### Assignments and grading

1. Confirm that the correct subjects appear under **Subjects**. If not, ask the administrator/HOD to check subject assignment, section/year and branch scope.
2. Create an assignment for an assigned subject with title, optional instructions, due date and optional maximum marks. It begins as a draft.
3. Review the draft and publish it. Published assignments are visible to eligible students. A draft can be deleted; published assignments should be closed rather than deleted.
4. Monitor submissions and pending students in the assignment detail/submission list. Students can submit after the deadline, with late status recorded.
5. Review and grade submissions. A teacher can grade only within the assignment/subject they can access. Once graded, the student's file is locked against replacement. Marks are not exposed to students.
6. Close the assignment when no more work should be accepted.

### Deadlines and official resources

- Post a deadline for an assigned subject, with a title, optional description and future due date. Edit or delete it if the date/instructions change. Students see it in their date-grouped timeline.
- Under **Resources**, create subject folders (for example, Unit 1, Lab Manuals, Previous Year Papers), upload the correct files and give them clear titles/names. Students can browse but cannot edit teacher resources.
- Deleting an uploaded resource/folder also deletes its associated S3 object(s). If storage deletion fails, the API reports an error and retains the database records; retry or ask the operator to investigate rather than assuming the file is gone.

### HOD/Incharge team workflows

An HOD/Incharge with team permissions uses **Hierarchy** to inspect their reporting chain and descendants, assign subjects within their scope, and grant/revoke teacher-capability or student-data-field permissions they themselves hold. They cannot manage peers or ancestors. A teacher with no team can still teach their assigned subjects but does not get team-management capabilities by tier label alone.

An authorized admin can use **Admin → Teacher assignments** to create and remove central assignments. Removing an assignment stops subject-based management/visibility; it does not delete the subject, assignment records or teaching history.

## 7. Admin ongoing workflows

### Student directory and placement

- **Students** is the operational directory: search by student identity and filter by branch, semester, status or admission year. Email/mobile visibility is masked unless the viewer holds the corresponding field permission.
- Update a student's semester/section/status only with verified college information. Disabling blocks login and revokes active sessions. Returning a student to pending activation clears their password; use this only under the institution's account-recovery process.
- Use **Export CSV** for filtered lists only when authorized. Placement/export access requires `EXPORT_STUDENT_PROFILES`; exports and full placement-profile reads are audited. Placement endpoints return time-limited signed file links, not permanent/public S3 URLs. Re-fetch profiles when links expire.
- Share downloaded student information only with approved recipients and according to college privacy policy. Export access can include sensitive personal and portfolio data.

### Admin and teacher permissions

Use **Permissions** to inspect the master list, and the administrator/teacher detail pages to manage individual grants where allowed. Use the least-privilege model:

| Permission                                         | Typical use                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `MANAGE_ADMIN_HIERARCHY`                           | Create/manage child admins and their access.                                                               |
| `MANAGE_ADMIN_ROLES`                               | Maintain permission metadata/master list; not ordinary account setup.                                      |
| `MANAGE_STUDENTS`                                  | Import/add students; change permitted student records/status; bulk semester changes.                       |
| `VIEW_STUDENTS`                                    | Browse student directory and student details.                                                              |
| `EXPORT_STUDENT_PROFILES`                          | Export CSV and access placement profiles.                                                                  |
| `MANAGE_ACADEMIC_STRUCTURE`                        | Create/edit branches and subjects.                                                                         |
| `MANAGE_TEACHERS`                                  | Create/update staff and manage teacher permissions.                                                        |
| `MANAGE_TEACHER_ASSIGNMENTS`                       | Assign/unassign teachers to subjects within the allowed scope.                                             |
| `CREATE_ASSIGNMENT`                                | Create and publish assignments.                                                                            |
| `MODERATE_PEER_RESOURCES`                          | Remove any peer post.                                                                                      |
| `VIEW_STUDENT_EMAIL`, `VIEW_STUDENT_MOBILE_NUMBER` | Unmask the relevant student field.                                                                         |
| `VIEW_STUDENT_MARKS`                               | Marks visibility outside a teacher's own taught-subject workflow, where an implementation uses this check. |
| `VIEW_AUDIT_LOGS`                                  | Read the audit trail.                                                                                      |

The permissions shown are the currently seeded capabilities. A permission grant never substitutes for the proper user/subject/descendant scope enforced by the backend. `VIEW_STUDENT_ADDRESS` is present in the permission master list, but the current student profile has no address field. There is no cross-subject marks report in the current panel; students do not see marks.

### Peer moderation and audit

Authorized moderators open **Admin → Peer Resources**, review posts and remove policy-violating or inappropriate material. Moderation deletion also removes its uploaded file and records an audit event. Apply the institution's moderation and escalation policy consistently; do not treat the peer feed as official teacher material.

**Audit logs** record sensitive/admin actions such as imports, exports, permission changes and moderation. Authorized administrators should review them during operational checks and when investigating unexpected account/data changes.

## 8. A complete launch-to-first-semester example

This illustrates a realistic first cohort without assuming that every institution has identical job titles.

1. **Operator** deploys the production services, email and private file storage, verifies backups, and hands the initial Super Admin credentials to the accountable system owner through a secure channel.
2. **Super Admin** changes the initial password, reviews seeded branches, adds any missing branches, and creates the term's branch/semester subject catalogue.
3. **Super Admin** creates a TPO admin beneath them. The TPO activates using their institutional email. The Super Admin grants `EXPORT_STUDENT_PROFILES` and only the other permissions required for placement work.
4. **Academic administrator** creates HOD and Incharge teacher accounts with correct tiers, primary branches and `Reports to` links. Each staff member activates from the web panel. The HOD/Incharge checks their reporting chain and receives/keeps the required teacher assignment-management permission.
5. **Administrator or eligible HOD/Incharge** assigns subject teachers to the term's subjects and sections for the correct academic year. The HOD/Incharge assignment path stays within their own scope.
6. **Student data operator** validates the official enrollment CSV, imports it, reviews inserted/updated/protected/invalid outcomes and resolves bad rows. They confirm semester/section records before launch invitations go out.
7. **Department** shares the mobile app and activation instructions with students. Students use the institutional email to receive their OTP, set a password, complete their profile, and ask the department to correct academic identity details if needed.
8. **Teachers** publish assignments, post practical/lab deadlines and organize official resources by subject. Students see the applicable coursework in Academics, submit work and use the reminder timeline.
9. **Students** continue updating resumes, projects, certificates, achievements and links throughout their course; peers share materials within class/branch/semester scopes.
10. **Teachers** review and grade their own subject submissions. TPO staff use authorized filters and placement exports when a recruiting/placement exercise requires them. Authorized administrators review audit activity and maintain records/access as staff or cohorts change.

This cycle repeats each semester: update student semester/section data, refresh teacher-subject assignments and academic-year values, then publish the new coursework. Keep old academic records and exported data according to the college's retention policy.

## 9. Routine operations, recovery and important limits

- **Wrong student email before activation:** correct the pending record through the official roster/re-import path; then ask the student to request a new OTP.
- **Student account activated with wrong details:** re-import will not overwrite an active account. An authorized administrator updates supported academic fields in the student record; students update their own profile fields.
- **Teacher cannot find subject:** verify the teacher account is active, the subject exists, the teacher-subject assignment is current and (for HOD/Incharge self-service) the subject is within their allowed scope.
- **OTP email not received:** verify the stored email and transactional-email configuration; observe the cooldown/hourly limits before requesting another code.
- **Private file does not open:** signed links expire (normally one hour). Refresh/re-fetch the record first. If a fresh link fails, investigate bucket/object existence, backend bucket/region, IAM and CORS/read permissions. Do not make the bucket public to work around a broken link.
- **File deletion reports an error:** the corresponding database record is intentionally retained when S3 deletion fails. Investigate the storage permission/configuration and retry; do not tell the user the file was permanently removed until deletion succeeds.
- **Database reset:** resetting PostgreSQL does not clear S3. Conversely, deleting S3 objects does not clear records in PostgreSQL or recreate uploads. Coordinate a database reset with any intended S3 cleanup, and only target the matching environment/bucket after confirming backups and ownership.
- **S3 lifecycle/orphans:** objects uploaded but never attached to a record, or old leftovers, are not automatically swept. Reconcile against database references before removing them. If bucket versioning is enabled, a delete marker alone is not permanent deletion; versions must also be purged.
- **Access issues:** check actual permissions, not only the role label or UI. Super Admin is the only unconditional bypass; all other users are constrained by explicit grants plus ownership, hierarchy and subject rules.
- **No built-in attendance, fees, student chat, push notifications, or online quizzes:** do not promise these as live workflows. The current academic areas are assignments, deadlines, teacher resources and Share with Peers.

## 10. Related operating references

- [`RUNBOOK.md`](RUNBOOK.md) — install, local development, deployment, environment and S3 operations.
- [`ACADEMICS_API.md`](ACADEMICS_API.md) — academic endpoint behaviors, file types, scopes and visibility.
- [`STUDENT_PORTFOLIO_API.md`](STUDENT_PORTFOLIO_API.md) — placement-profile access, privacy and expiring links.
- [`PROJECT_UNDERSTANDING.md`](PROJECT_UNDERSTANDING.md) — product model and architecture context.

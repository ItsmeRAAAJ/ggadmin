export type OtpPurpose = "FIRST_LOGIN" | "PASSWORD_RESET";

export type LookupResult =
  | { next: "PASSWORD"; role: string; message?: string }
  | { next: "OTP"; role: string; maskedEmail: string; resendAvailableInSeconds: number; message?: string };

export type Branch = { id: string; shortCode: string; name: string };

export type Certificate = {
  id: string;
  title: string;
  issuer: string | null;
  issueDate: string | null;
  fileUrl: string | null;
  createdAt: string;
};

export type Project = {
  id: string;
  title: string;
  description: string | null;
  techStack: string[];
  link: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

export type AchievementCategory = "ACADEMIC" | "CO_CURRICULAR" | "EXTRA_CURRICULAR";

export type Achievement = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  category: AchievementCategory;
  fileUrl: string | null;
  createdAt: string;
};

export type SocialPlatform = "LINKEDIN" | "GITHUB" | "PORTFOLIO" | "OTHER";
export type SocialLink = { id: string; platform: SocialPlatform; url: string };

export type CompletenessItem = { key: string; label: string; done: boolean };

export type StudentProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  admissionYear: number;
  passoutYear: number | null;
  currentSemester: number;
  section: string | null;
  profileImageUrl: string | null;
  techResumeUrl: string | null;
  nonTechResumeUrl: string | null;
  email: string;
  enrollmentNumber: string | null;
  branch: Branch;
  certificates: Certificate[];
  projects: Project[];
  achievements: Achievement[];
  socialLinks: SocialLink[];
  completeness: { percent: number; missing: CompletenessItem[] };
};

export type SubjectRef = { id?: string; name: string; code: string };

export type SubmissionStatus = "NOT_SUBMITTED" | "SUBMITTED" | "LATE";

export type AssignmentListItem = {
  id: string;
  title: string;
  subject: SubjectRef;
  dueAt: string;
  status: "PUBLISHED" | "CLOSED";
  isOverdue: boolean;
  canSubmit: boolean;
  submissionStatus: SubmissionStatus;
  submittedAt: string | null;
};

export type AssignmentDetail = Omit<AssignmentListItem, "submissionStatus" | "submittedAt"> & {
  description: string | null;
  teacherName: string;
  submission: { status: SubmissionStatus; submittedAt: string; fileUrl: string | null } | null;
};

export type PresignedUpload = { uploadUrl: string; fileUrl: string; expiresIn: number };

export type LocalFile = { uri: string; name: string; mimeType: string; size?: number | undefined };

// ── Academics ────────────────────────────────────────────────────────────────

export type DeadlineItem = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  /** Calendar day (YYYY-MM-DD) in the college timezone. */
  date: string;
  /** 0 = today, 1 = tomorrow, negative = past. */
  daysLeft: number;
  isPast: boolean;
  subject: SubjectRef & { id: string };
  teacherName: string;
};

export type DeadlineGroup = { date: string; daysLeft: number; items: DeadlineItem[] };
export type DeadlinesResponse = { timezone: string; items: DeadlineItem[]; groups: DeadlineGroup[] };

export type AcademicSubject = { id: string; name: string; code: string; semester: number; folderCount: number; fileCount: number };

export type ResourceFolderSummary = { id: string; name: string; order: number; fileCount: number; createdAt: string };

export type SubjectResources = {
  subject: { id: string; name: string; code: string; semester: number };
  folders: ResourceFolderSummary[];
};

export type ResourceFileItem = {
  id: string;
  title: string;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  fileUrl: string | null;
  teacherName: string;
  createdAt: string;
};

export type ResourceFolderDetail = {
  id: string;
  name: string;
  subject: { id: string; name: string; code: string; semester: number };
  files: ResourceFileItem[];
};

export type PeerCategory = "PREVIOUS_YEAR_PAPER" | "LAB_MANUAL" | "REFERENCE_MATERIAL" | "USEFUL_LINK" | "CHEATSHEET" | "OTHER";
export type PeerScope = "CLASS" | "BRANCH" | "SEMESTER";

export type PeerPost = {
  id: string;
  title: string;
  description: string | null;
  category: PeerCategory;
  scope: PeerScope;
  kind: "FILE" | "LINK";
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  linkUrl: string | null;
  subject: { id: string; name: string; code: string } | null;
  createdAt: string;
  isMine?: boolean;
  uploader: { name: string; avatarUrl: string | null; branch: string; semester: number };
};

export type PeerFeedPage = { items: PeerPost[]; page: number; limit: number; hasMore: boolean };

export type PeerFeedQuery = {
  q?: string;
  category?: PeerCategory;
  scope?: PeerScope;
  subjectId?: string;
  mine?: boolean;
  page?: number;
  limit?: number;
};

export type CreatePeerPost = {
  title: string;
  description?: string | null;
  category: PeerCategory;
  scope: PeerScope;
  subjectId?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  linkUrl?: string | null;
};

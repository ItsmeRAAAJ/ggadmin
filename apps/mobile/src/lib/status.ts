import type { BadgeTone } from "@/components/ui";
import type { AssignmentDetail, AssignmentListItem } from "./types";

type AssignmentLike = Pick<AssignmentListItem, "status" | "isOverdue" | "canSubmit"> & {
  submissionStatus: AssignmentListItem["submissionStatus"];
};

export function assignmentView(a: AssignmentLike): { label: string; tone: BadgeTone; pending: boolean } {
  const submitted = a.submissionStatus !== "NOT_SUBMITTED";
  if (submitted) {
    // Submission exists but can't be replaced while still open → teacher has reviewed it.
    if (!a.canSubmit && a.status === "PUBLISHED" && !a.isOverdue) return { label: "Reviewed", tone: "success", pending: false };
    if (a.submissionStatus === "LATE") return { label: "Submitted late", tone: "warning", pending: false };
    return { label: "Submitted", tone: "success", pending: false };
  }
  if (a.status === "CLOSED") return { label: "Closed", tone: "neutral", pending: false };
  if (a.isOverdue) return { label: a.canSubmit ? "Overdue" : "Missed", tone: "danger", pending: a.canSubmit };
  return { label: "Pending", tone: "warning", pending: true };
}

export function assignmentDetailView(a: AssignmentDetail) {
  return assignmentView({ ...a, submissionStatus: a.submission?.status ?? "NOT_SUBMITTED" });
}

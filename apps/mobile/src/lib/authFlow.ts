import type { OtpPurpose } from "./types";

/**
 * Ephemeral, in-memory state for the multi-step sign-in flow.
 * Short-lived onboarding/reset tokens are kept here rather than in route params so they never
 * appear in navigation state, deep links or logs.
 */
type Flow = {
  identifier: string;
  purpose?: OtpPurpose;
  maskedEmail?: string;
  resendAt?: number;
  pendingToken?: { kind: "onboard" | "reset"; token: string };
};

let flow: Flow = { identifier: "" };

export const authFlow = {
  get: () => flow,
  start: (identifier: string) => {
    flow = { identifier };
  },
  patch: (p: Partial<Flow>) => {
    flow = { ...flow, ...p };
  },
  clear: () => {
    flow = { identifier: "" };
  },
};

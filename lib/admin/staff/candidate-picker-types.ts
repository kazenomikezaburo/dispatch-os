export type CandidateReason = {
  code: string;
  category: string;
  classification: "blocking" | "warning" | "informational";
  label: string;
};

export type CandidateRequirement = {
  kind: "skill" | "qualification";
  masterId: string;
  code: string;
  name: string;
  state: string;
  validFrom?: string;
  expiresOn?: string;
};

export type CandidateFacts = {
  sourceAvailable: true;
  candidateEligible: boolean;
  workerStatusEligible: boolean;
  requirementsEligible: boolean;
  availabilityEligible: boolean;
  overlapEligible: boolean;
  requirements: CandidateRequirement[];
  availabilityState: string;
  availabilityCoverage: string;
  conflictingAssignments: { assignmentId: string; shiftId: string; startsAt: string; endsAt: string }[];
  preferenceMatches: {
    preferredSchedule: string;
    preferredArea: string;
    preferredWorkCategory: string;
    transport: string;
  };
  blockingReasons: CandidateReason[];
  warnings: CandidateReason[];
  information: CandidateReason[];
  targetShiftAssignment: {
    state: "none" | "active_existing";
    assignmentId: string | null;
    status: string | null;
  };
};

export type CandidateAssignmentDecision =
  | "direct_admin_available"
  | "accepted_application_available"
  | "application_decision_required"
  | "application_rejected"
  | "application_withdrawn"
  | "existing_assignment";

export type ShiftCandidate = {
  workerId: string;
  displayName: string;
  staffCode: string;
  facts: CandidateFacts;
  assignmentDecision: CandidateAssignmentDecision;
};

export type ShiftCandidateResult =
  | { ok: true; sourceAvailable: true; items: ShiftCandidate[]; truncated: boolean; limit: number }
  | { ok: false; sourceAvailable: false; items: []; truncated: false; limit: number };

export type CandidateGroup = "eligible" | "warning" | "ineligible";

export function candidateGroup(candidate: ShiftCandidate): CandidateGroup {
  if (!candidate.facts.candidateEligible) return "ineligible";
  return candidate.facts.warnings.length > 0 ? "warning" : "eligible";
}

export function candidateAssignmentDecision(
  targetState: CandidateFacts["targetShiftAssignment"]["state"],
  applicationStatus?: "applied" | "accepted" | "rejected" | "withdrawn",
): CandidateAssignmentDecision {
  if (targetState === "active_existing") return "existing_assignment";
  if (applicationStatus === "accepted") return "accepted_application_available";
  if (applicationStatus === "applied") return "application_decision_required";
  if (applicationStatus === "rejected") return "application_rejected";
  if (applicationStatus === "withdrawn") return "application_withdrawn";
  return "direct_admin_available";
}

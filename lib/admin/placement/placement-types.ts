import type { ShiftListItem } from "@/lib/admin/shifts/shift-list-types";
import type { AssignmentStatus } from "@/lib/admin/shifts/shift-detail-types";
import type { ShiftStatus } from "@/lib/admin/projects/project-detail-types";

export type PlacementQuery = {
  date: string;
  q: string;
  project: string;
  staffing: "all" | "shortage" | "filled";
  shift: string;
  page: number;
};

export type PlacementShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  required_workers: number;
  break_minutes: number | null;
  status: ShiftStatus;
  jobs: {
    name: string;
    projects: { id: string; name: string } | null;
    workplaces: { name: string } | null;
  } | null;
};

export type PlacementAssignmentRow = {
  id: string;
  shift_slot_id: string;
  status: AssignmentStatus;
  workers: { id: string; display_name: string; staff_code: string } | null;
};

export type PlacementStaff = {
  assignmentId: string;
  status: AssignmentStatus;
  worker: { id: string; name: string; staffCode: string } | null;
};

export type PlacementShift = ShiftListItem & {
  projectId: string;
  breakMinutes: number | null;
  staff: PlacementStaff[];
  planSummary?: PlacementPlanSummary;
};

export type PlacementPosition = { id: string; label: string; requiredWorkers: number | null; displayOrder: number; retired: boolean };
export type PlacementSegment = { id: string; assignmentId: string; positionId: string; startAt: string; endAt: string };
export type PlacementBreak = { id: string; assignmentId: string; startAt: string; endAt: string };
export type PlacementPlanSummary = { version: number; positions: { id: string; label: string; requiredWorkers: number | null; placedWorkers: number }[]; warningCount: number };
export type PlacementPlan = {
  planId: string | null; version: number; shiftId: string; startsAt: string; endsAt: string;
  requiredWorkers: number; breakMinutes: number | null; correctionRequired: boolean;
  positions: PlacementPosition[]; segments: PlacementSegment[]; breaks: PlacementBreak[];
  assignments: PlacementStaff[];
};

export type PlacementSaveInput = Pick<PlacementPlan, "shiftId" | "version" | "positions" | "segments" | "breaks"> & { idempotencyKey: string; reason: string };
export type PlacementSaveResult =
  | { ok: true; version: number; warnings: unknown[]; replayed: boolean }
  | { ok: false; type: "validation" | "conflict" | "forbidden" | "notFound" | "error"; code?: string; message: string; currentVersion?: number };

export type PlacementResult = { ok: true; shifts: PlacementShift[] } | { ok: false };

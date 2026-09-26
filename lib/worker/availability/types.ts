export type AvailabilityKind = "available" | "consultable" | "unavailable";

export type AvailabilityInterval = {
  id: string;
  kind: AvailabilityKind;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

export type WorkConditions = {
  preferredIsoWeekdays: number[];
  preferredStartLocal: string | null;
  preferredEndLocal: string | null;
  preferredEndsNextDay: boolean;
  preferredAreaNote: string | null;
  preferredWorkCategoryNote: string | null;
  transportPreferenceNote: string | null;
  isActive: boolean;
} | null;

export type WorkerAvailabilityData = {
  intervals: AvailabilityInterval[];
  workConditions: WorkConditions;
};

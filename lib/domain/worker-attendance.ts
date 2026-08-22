export type WorkerAttendanceState = "not_started" | "working" | "finished";

export type WorkerAttendanceEvent = {
  eventType: "start_work" | "end_work";
  serverReceivedAt: string;
};

export function getWorkerAttendanceState(events: WorkerAttendanceEvent[]): WorkerAttendanceState {
  const hasStart = events.some((event) => event.eventType === "start_work");
  const hasEnd = events.some((event) => event.eventType === "end_work");
  if (hasStart && hasEnd) return "finished";
  if (hasStart) return "working";
  return "not_started";
}

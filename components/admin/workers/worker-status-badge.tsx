import type { WorkerStatus } from "@/lib/admin/workers/worker-types";
const labels:Record<WorkerStatus,string>={active:"稼働可",inactive:"休止中",suspended:"停止中"};
export function WorkerStatusBadge({status}:{status:WorkerStatus}){const tone=status==="active"?"bg-success-subtle text-success":status==="suspended"?"bg-danger-subtle text-danger":"bg-surface-muted text-foreground-secondary";return <span className={`inline-flex min-h-7 items-center rounded-control px-2.5 text-xs font-semibold ${tone}`}>{labels[status]}</span>}

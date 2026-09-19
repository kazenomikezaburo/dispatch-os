import type { WorkerStatus } from "@/lib/admin/workers/worker-types";
import { AdminStatusBadge } from "@/components/admin/admin-visual-primitives";
const labels:Record<WorkerStatus,string>={active:"稼働可",inactive:"休止中",suspended:"停止中"};
export function WorkerStatusBadge({status}:{status:WorkerStatus}){return <AdminStatusBadge tone={status==="active"?"success":status==="suspended"?"danger":"neutral"}>{labels[status]}</AdminStatusBadge>}

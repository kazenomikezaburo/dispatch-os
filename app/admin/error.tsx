"use client";
import { AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <AdminErrorState><button type="button" onClick={reset} className={adminStateActionClass}>再試行</button></AdminErrorState>; }

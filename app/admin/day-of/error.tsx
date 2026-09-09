"use client";
import {AdminErrorState,adminStateActionClass} from "@/components/admin/admin-state";
export default function Error({reset}:{reset:()=>void}){return <AdminErrorState title="当日運用画面を表示できませんでした。"><button type="button" onClick={reset} className={adminStateActionClass}>再試行</button></AdminErrorState>}

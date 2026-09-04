import Link from "next/link";
import { AdminNotFoundState, adminStateActionClass } from "@/components/admin/admin-state";
export default function NotFound() { return <AdminNotFoundState><Link href="/admin" className={adminStateActionClass}>ホームへ戻る</Link></AdminNotFoundState>; }

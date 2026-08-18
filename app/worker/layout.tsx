import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { requireWorker } from "@/lib/auth/require-worker";

export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const profile = await requireWorker();
  return <div className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4"><div><p className="font-semibold text-slate-900">ワーカーホーム</p><p className="text-sm text-slate-600">こんにちは、{profile.display_name}さん</p></div><form action={logout}><button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">ログアウト</button></form></div></header>{children}</div>;
}

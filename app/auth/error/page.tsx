import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <h1 className="text-xl font-semibold text-slate-900">アカウントエラー</h1>
      <p className="mt-4 text-slate-700">{reason === "inactive" ? "このアカウントは現在利用できません。" : "アカウント情報が正しく設定されていません。"}<br />管理者へお問い合わせください。</p>
      <div className="mt-8 flex justify-center gap-3"><Link href="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">ログイン画面へ</Link><form action={logout}><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" type="submit">ログアウト</button></form></div>
    </section></main>
  );
}

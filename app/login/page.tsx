import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

type LoginPageProps = { searchParams: Promise<{ error?: string; reason?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [result, params] = await Promise.all([getCurrentProfile(), searchParams]);
  if (result.status === "authenticated") redirect(result.profile.account_type === "worker" ? "/worker" : "/admin");
  if (result.status === "inactive") redirect("/auth/error?reason=inactive");
  if (result.status === "misconfigured") redirect("/auth/error");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">派遣業務OS</h1>
        <p className="mt-2 text-sm text-slate-600">アカウント情報を入力してログインしてください</p>
        {params.error === "invalid_credentials" && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">メールアドレスまたはパスワードが正しくありません。</p>}
        {params.reason === "session_expired" && <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">セッションの有効期限が切れました。もう一度ログインしてください。</p>}
        <form action={login} className="mt-6 space-y-5">
          <div><label htmlFor="email" className="text-sm font-medium text-slate-700">メールアドレス</label><input id="email" name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500" /></div>
          <div><label htmlFor="password" className="text-sm font-medium text-slate-700">パスワード</label><input id="password" name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-500" /></div>
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white hover:bg-slate-700">ログイン</button>
        </form>
      </section>
    </main>
  );
}

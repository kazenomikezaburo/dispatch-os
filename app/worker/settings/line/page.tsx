import { CheckCircle2, CircleOff, MessageCircle, ShieldCheck } from "lucide-react";
import { setOwnLineReminders, startOwnLineLink, unlinkOwnLineAccount } from "@/app/actions/worker-line";
import { LineSubmitButton } from "@/components/worker/line/line-settings-actions";
import { requireWorker } from "@/lib/auth/require-worker";
import { getLineServerConfig } from "@/lib/line/config";
import { getWorkerLineStatus } from "@/lib/worker/line/get-worker-line-status";

type Props = { searchParams: Promise<{ result?: string }> };

const messages: Record<string, { tone: string; text: string }> = {
  linked: { tone: "bg-success-subtle text-success-foreground", text: "LINE連携が完了しました。リマインダー配信はまだOFFです。" },
  linked_unavailable: { tone: "bg-warning-subtle text-warning-foreground", text: "LINEアカウントを確認しました。公式アカウントを友だち追加すると配信をONにできます。" },
  enabled: { tone: "bg-success-subtle text-success-foreground", text: "今後作成されるリマインダーのLINE配信をONにしました。" },
  disabled: { tone: "bg-surface-muted text-foreground-secondary", text: "LINEリマインダーをOFFにしました。" },
  unlinked: { tone: "bg-surface-muted text-foreground-secondary", text: "LINE連携を解除しました。" },
  configuration_unavailable: { tone: "bg-warning-subtle text-warning-foreground", text: "LINE連携は現在設定中です。しばらくしてからお試しください。" },
  link_conflict: { tone: "bg-danger-subtle text-danger-foreground", text: "このLINEアカウントは連携できませんでした。別のアカウントを確認してください。" },
  link_invalid: { tone: "bg-danger-subtle text-danger-foreground", text: "連携の有効期限が切れたか、すでに使用されています。最初からやり直してください。" },
  provider_failed: { tone: "bg-danger-subtle text-danger-foreground", text: "LINEとの確認に失敗しました。時間をおいてやり直してください。" },
  link_start_failed: { tone: "bg-danger-subtle text-danger-foreground", text: "LINE連携を開始できませんでした。" },
  consent_failed: { tone: "bg-danger-subtle text-danger-foreground", text: "LINEリマインダー設定を変更できませんでした。" },
  unlink_failed: { tone: "bg-danger-subtle text-danger-foreground", text: "LINE連携を解除できませんでした。" },
};

export default async function WorkerLineSettingsPage({ searchParams }: Props) {
  await requireWorker();
  const params = await searchParams;
  const configAvailable = getLineServerConfig() !== null;
  let status: Awaited<ReturnType<typeof getWorkerLineStatus>> | null = null;
  try { status = await getWorkerLineStatus(); } catch { /* controlled unavailable state */ }
  const feedback = params.result ? messages[params.result] : null;

  return <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
    <header><p className="text-sm font-semibold text-link">通知設定</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">LINE連携</h1><p className="mt-2 text-sm leading-6 text-foreground-secondary">LINEは通知とOpsCueへの入口です。勤務状況の記録や変更はOpsCueで行います。</p></header>
    {feedback && <p role="status" className={`mt-5 rounded-control p-4 text-sm ${feedback.tone}`}>{feedback.text}</p>}
    {!status ? <section role="alert" className="mt-6 rounded-card border border-danger/25 bg-surface p-5"><h2 className="font-semibold">LINE設定を取得できませんでした</h2><p className="mt-2 text-sm text-foreground-secondary">時間をおいて再度お試しください。</p></section> :
      <div className="mt-6 space-y-5">
        <section className="rounded-card border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info-subtle text-info"><MessageCircle aria-hidden className="size-5" /></span><div className="min-w-0"><h2 className="font-semibold">アカウント連携</h2><p className="mt-1 text-sm text-foreground-secondary">{status.status === "unlinked" ? "未連携" : status.status === "linked_available" ? "連携済み・通知先を利用できます" : status.status === "linked_unavailable" ? "連携済み・通知先を利用できません" : "連携は一時停止中です"}</p></div></div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <form action={startOwnLineLink}><LineSubmitButton label={status.linked ? "LINEを再連携" : "LINEを連携"} pendingLabel="LINEへ移動中…" /></form>
            {status.linked && <form action={unlinkOwnLineAccount}><LineSubmitButton label="連携を解除" pendingLabel="解除中…" tone="danger" /></form>}
          </div>
          {!configAvailable && <p className="mt-3 text-sm text-warning-foreground">プロバイダー設定が未完了のため、連携を開始できません。</p>}
        </section>
        <section className="rounded-card border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">{status.externalRemindersEnabled ? <CheckCircle2 aria-hidden className="mt-0.5 size-6 shrink-0 text-success" /> : <CircleOff aria-hidden className="mt-0.5 size-6 shrink-0 text-foreground-muted" />}<div><h2 className="font-semibold">勤務リマインダー</h2><p className="mt-1 text-sm leading-6 text-foreground-secondary">{status.externalRemindersEnabled ? "LINE配信はONです。ONにした後に作成されたリマインダーだけが対象です。" : "LINE配信はOFFです。OpsCue内の通知は引き続き届きます。"}</p></div></div>
          <form action={setOwnLineReminders} className="mt-5"><input type="hidden" name="enabled" value={status.externalRemindersEnabled ? "false" : "true"} /><LineSubmitButton label={status.externalRemindersEnabled ? "LINEリマインダーをOFFにする" : "LINEリマインダーをONにする"} pendingLabel="変更中…" tone={status.externalRemindersEnabled ? "secondary" : "primary"} /></form>
          {!status.externalRemindersEnabled && status.status !== "linked_available" && <p className="mt-3 text-sm text-foreground-muted">ONにするには、LINE連携と公式アカウントの友だち追加が必要です。</p>}
        </section>
        <section className="rounded-card border border-border bg-surface p-5"><div className="flex gap-3"><ShieldCheck aria-hidden className="size-5 shrink-0 text-info" /><div><h2 className="font-semibold">安全な連携</h2><p className="mt-1 text-sm leading-6 text-foreground-secondary">LINEの表示名やメールアドレスでは照合しません。連携先の識別子や認証情報は画面に表示せず、通知本文にも保存しません。</p></div></div></section>
      </div>}
  </main>;
}

"use client";

import { useCallback, useState } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveClient } from "@/app/actions/clients";
import { saveWorkplace } from "@/app/actions/workplaces";
import {
  AdminFeedback,
  AdminForbiddenState,
  adminStateActionClass,
} from "@/components/admin/admin-state";
import { Drawer } from "@/components/admin/drawer";
import type {
  BranchOption,
  ClientItem,
  WorkplaceItem,
} from "@/lib/admin/masters/master-types";

const field =
  "mt-1.5 min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-focus-ring focus:ring-2 focus:ring-info-subtle disabled:bg-surface-muted";
type Props = {
  kind: "client" | "workplace";
  branches: BranchOption[];
  item?: ClientItem | WorkplaceItem;
};

export function MasterEditor({ kind, branches, item }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    type: string;
    message?: string;
    fieldErrors?: Record<string, string>;
  } | null>(null);
  const close = useCallback(() => {
    if (!pending) setOpen(false);
  }, [pending]);
  const isClient = kind === "client";
  const title = isClient ? "取引先" : "勤務先";
  const titleId = `${kind}-editor-title-${item?.id ?? "new"}`;
  const workplace = !isClient && item ? (item as WorkplaceItem) : undefined;
  const client = isClient && item ? (item as ClientItem) : undefined;

  async function submit(formData: FormData) {
    setPending(true);
    setResult(null);
    const common = {
      branchId: String(formData.get("branchId") ?? ""),
      name: String(formData.get("name") ?? ""),
      isActive: formData.get("isActive") === "true",
      ...(item ? { id: item.id, expectedUpdatedAt: item.updatedAt } : {}),
    };
    const payload = isClient
      ? { ...common, note: String(formData.get("note") ?? "") }
      : {
          ...common,
          postalCode: String(formData.get("postalCode") ?? ""),
          address: String(formData.get("address") ?? ""),
          defaultTransportNote: String(formData.get("defaultTransportNote") ?? ""),
          accessNote: String(formData.get("accessNote") ?? ""),
          meetingNote: String(formData.get("meetingNote") ?? ""),
        };
    const saved = await (isClient ? saveClient(payload) : saveWorkplace(payload));
    setPending(false);
    if (saved.ok) {
      setOpen(false);
      router.refresh();
      return;
    }
    setResult(saved);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className={
          item
            ? "inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong px-3 text-sm font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring"
            : "inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-focus-ring"
        }
      >
        {item ? <Pencil aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
        {item ? "編集" : `${title}を追加`}
      </button>
      <Drawer open={open} titleId={titleId} closeDisabled={pending} onClose={close}>
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-surface p-4 sm:p-6">
          <div>
            <h2 id={titleId} className="text-xl font-semibold">
              {title}を{item ? "編集" : "追加"}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">一覧を離れずに保存します。</p>
          </div>
          <button
            autoFocus
            type="button"
            disabled={pending}
            onClick={close}
            aria-label={`${title}編集を閉じる`}
            className="inline-flex size-11 items-center justify-center rounded-control hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>
        {open && (
          <form action={submit} className="space-y-5 p-4 sm:p-6">
            <fieldset disabled={pending} className="space-y-5">
              {result?.type === "forbidden" ? (
                <AdminForbiddenState message={result.message} />
              ) : (
                result?.message && (
                  <AdminFeedback
                    kind={result.type === "conflict" ? "conflict" : "error"}
                    message={result.message}
                  />
                )
              )}
              <label className="block text-sm font-medium">
                支店
                <select
                  name="branchId"
                  defaultValue={item?.branchId ?? branches[0]?.id}
                  disabled={Boolean(item)}
                  className={field}
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {item && <input type="hidden" name="branchId" value={item.branchId} />}
                <span className="mt-1 block text-xs text-foreground-muted">
                  作成後は変更できません。
                </span>
              </label>
              <Field label={`${title}名`} error={result?.fieldErrors?.name}>
                <input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={item?.name}
                  className={field}
                />
              </Field>
              {isClient ? (
                <Field label="メモ" error={result?.fieldErrors?.note}>
                  <textarea
                    name="note"
                    rows={6}
                    maxLength={2000}
                    defaultValue={client?.note ?? ""}
                    className={field}
                  />
                </Field>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="郵便番号">
                      <input
                        name="postalCode"
                        maxLength={20}
                        defaultValue={workplace?.postalCode ?? ""}
                        className={field}
                      />
                    </Field>
                    <Field label="住所" error={result?.fieldErrors?.address}>
                      <input
                        name="address"
                        required
                        maxLength={500}
                        defaultValue={workplace?.address}
                        className={field}
                      />
                    </Field>
                  </div>
                  <Field label="交通案内">
                    <textarea
                      name="defaultTransportNote"
                      rows={3}
                      maxLength={1000}
                      defaultValue={workplace?.defaultTransportNote ?? ""}
                      className={field}
                    />
                  </Field>
                  <Field label="アクセス補足">
                    <textarea
                      name="accessNote"
                      rows={3}
                      maxLength={1000}
                      defaultValue={workplace?.accessNote ?? ""}
                      className={field}
                    />
                  </Field>
                  <Field label="集合案内">
                    <textarea
                      name="meetingNote"
                      rows={3}
                      maxLength={1000}
                      defaultValue={workplace?.meetingNote ?? ""}
                      className={field}
                    />
                  </Field>
                </>
              )}
              <label className="block text-sm font-medium">
                状態
                <select
                  name="isActive"
                  defaultValue={String(item?.isActive ?? true)}
                  className={field}
                >
                  <option value="true">有効</option>
                  <option value="false">無効</option>
                </select>
              </label>
              {pending && (
                <AdminFeedback kind="pending" message="保存しています。この画面を閉じないでください。" />
              )}
              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={close} className={adminStateActionClass}>
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="min-h-11 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:bg-surface-muted"
                >
                  {pending ? "保存中..." : "保存する"}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </Drawer>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {error && <span className="mt-1.5 block text-sm text-danger">{error}</span>}
    </label>
  );
}

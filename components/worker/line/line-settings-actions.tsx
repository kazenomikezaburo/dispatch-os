"use client";

import { useFormStatus } from "react-dom";

export function LineSubmitButton({ label, pendingLabel, tone = "primary" }: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const colors = tone === "primary"
    ? "bg-primary text-primary-foreground hover:bg-primary-hover"
    : tone === "danger"
      ? "border border-danger text-danger hover:bg-danger-subtle"
      : "border border-border-strong bg-surface hover:bg-surface-hover";
  return <button type="submit" disabled={pending} className={`inline-flex min-h-12 w-full items-center justify-center rounded-control px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-wait disabled:opacity-60 sm:w-auto ${colors}`}>{pending ? pendingLabel : label}</button>;
}

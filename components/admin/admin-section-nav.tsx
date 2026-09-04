import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function AdminSectionNav({ label, items }: { label: string; items: readonly { label: string; href: string; current?: boolean }[] }) {
  return <nav aria-label={label} className="flex flex-wrap gap-1 rounded-control border border-border bg-surface p-1">
    {items.map((item) => <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined} className={cn("inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring", item.current ? "bg-surface-selected text-link" : "text-foreground-secondary")}>{item.label}</Link>)}
  </nav>;
}

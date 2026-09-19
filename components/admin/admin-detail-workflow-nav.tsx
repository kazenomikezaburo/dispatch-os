import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import {
  adminDetailTabClass,
  adminNavigationTabActiveClass,
  adminNavigationTabBaseClass,
} from "@/components/admin/admin-navigation-tab-styles";

export type AdminDetailNavItem = {
  label: string;
  href: string;
  current?: boolean;
};

export function AdminDetailWorkflowNav({ label, items }: { label: string; items: readonly AdminDetailNavItem[] }) {
  return <nav aria-label={label} className="overflow-x-auto border-b border-border">
    <div className="flex min-w-max gap-1">
      {items.map((item) => <Link key={item.href} href={item.href} aria-current={item.current ? "page" : undefined} className={cn(
        adminNavigationTabBaseClass,
        adminDetailTabClass,
        item.current && adminNavigationTabActiveClass,
      )}>{item.label}</Link>)}
    </div>
  </nav>;
}

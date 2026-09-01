import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireAdmin();
  const cookieStore = await cookies();
  const accountType =
    profile.account_type === "system_admin" ? "system_admin" : "manager";
  const initialCollapsed =
    cookieStore.get("dispatch_admin_sidebar")?.value === "collapsed";

  return (
    <AdminShell
      initialCollapsed={initialCollapsed}
      user={{
        id: profile.id,
        displayName: profile.display_name,
        accountType,
      }}
    >
      {children}
    </AdminShell>
  );
}

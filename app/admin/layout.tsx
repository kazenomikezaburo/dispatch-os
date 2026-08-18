import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const profile = await requireAdmin();
  const accountType =
    profile.account_type === "system_admin" ? "system_admin" : "manager";

  return (
    <AdminShell
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

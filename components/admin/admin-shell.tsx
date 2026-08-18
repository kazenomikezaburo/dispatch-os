import type { ReactNode } from "react";
import { AdminHeader } from "./admin-header";
import { AdminSidebar } from "./admin-sidebar";
import { AdminUserMenu } from "./admin-user-menu";

export type AdminShellUser = {
  id: string;
  displayName: string;
  accountType: "manager" | "system_admin";
};

export function AdminShell({ children, user }: { children: ReactNode; user: AdminShellUser }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <AdminSidebar />
      <div className="min-w-0 lg:pl-60">
        <AdminHeader userMenu={<AdminUserMenu displayName={user.displayName} accountType={user.accountType} />} />
        <main className="w-full p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

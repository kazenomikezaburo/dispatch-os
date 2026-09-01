import type { ReactNode } from "react";
import { AdminShellFrame } from "./admin-shell-frame";
import { AdminUserMenu } from "./admin-user-menu";

export type AdminShellUser = {
  id: string;
  displayName: string;
  accountType: "manager" | "system_admin";
};

export function AdminShell({
  children,
  initialCollapsed,
  user,
}: {
  children: ReactNode;
  initialCollapsed: boolean;
  user: AdminShellUser;
}) {
  return (
    <AdminShellFrame
      initialCollapsed={initialCollapsed}
      userMenu={
        <AdminUserMenu
          displayName={user.displayName}
          accountType={user.accountType}
        />
      }
    >
      {children}
    </AdminShellFrame>
  );
}

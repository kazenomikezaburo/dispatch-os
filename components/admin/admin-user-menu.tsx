import { logout } from "@/app/actions/auth";

type AdminUserMenuProps = {
  displayName: string;
  accountType: "manager" | "system_admin";
};

const roleLabels = {
  manager: "管理者",
  system_admin: "システム管理者",
} as const;

export function AdminUserMenu({ displayName, accountType }: AdminUserMenuProps) {
  return (
    <details className="group relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-3 rounded-md px-2 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
        <span className="hidden sm:block"><span className="block max-w-48 truncate text-sm font-medium text-slate-900">{displayName}</span><span className="block text-xs text-slate-500">{roleLabels[accountType]}</span></span>
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-700">{displayName.trim().charAt(0) || "管"}</span>
        <span aria-hidden="true" className="text-xs text-slate-500">▼</span>
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
        <div className="border-b border-slate-100 px-3 py-2 sm:hidden"><p className="truncate text-sm font-medium text-slate-900">{displayName}</p><p className="text-xs text-slate-500">{roleLabels[accountType]}</p></div>
        <form action={logout} className="pt-1 sm:pt-0"><button type="submit" className="min-h-10 w-full px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">ログアウト</button></form>
      </div>
    </details>
  );
}

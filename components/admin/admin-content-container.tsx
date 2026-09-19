import type { ReactNode } from "react";
import { AdminBreadcrumb } from "./admin-breadcrumb";

export function AdminContentContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 sm:mb-6">
        <AdminBreadcrumb />
      </div>
      {children}
    </div>
  );
}

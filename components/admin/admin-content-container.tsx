import type { ReactNode } from "react";

export function AdminContentContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {children}
    </div>
  );
}

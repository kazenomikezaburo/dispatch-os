import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type AdminPageWidth = "default" | "form" | "form-wide";

const widthClassName: Record<AdminPageWidth, string> = {
  default: "w-full",
  form: "mx-auto w-full max-w-3xl",
  "form-wide": "mx-auto w-full max-w-4xl",
};

export function AdminPage({
  children,
  width = "default",
}: {
  children: ReactNode;
  width?: AdminPageWidth;
}) {
  return <div className={cn("min-w-0 space-y-6 lg:space-y-8", widthClassName[width])}>{children}</div>;
}

import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow,
  titleId = "page-title",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  titleId?: string;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-medium text-link">{eyebrow}</p>}
        <h1 id={titleId} className={eyebrow ? "mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]" : "text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]"}>
          {title}
        </h1>
        {description && <p className="mt-2 text-sm text-foreground-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function DashboardEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-panel border border-dashed border-border-strong bg-surface-subtle px-5 py-8 text-center text-sm text-foreground-secondary">
      {message}
    </div>
  );
}

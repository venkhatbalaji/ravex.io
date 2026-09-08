const STYLES = {
  open: "bg-accent/10 text-accent-text",
  locked: "bg-warning-text/10 text-warning-text",
  settled: "bg-surface-2 text-muted",
} as const;

const LABELS = { open: "Live", locked: "Locked", settled: "Settled" } as const;

export function StatusBadge({ status }: { status: keyof typeof STYLES }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STYLES[status]}`}
    >
      {status === "open" && <span className="live-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent" />}
      {LABELS[status]}
    </span>
  );
}

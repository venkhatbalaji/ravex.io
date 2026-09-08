import type { Outcome } from "@/lib/api";

const SEGMENT_COLORS = ["bg-accent", "bg-accent-2", "bg-emerald-400", "bg-lime-300", "bg-teal-300"];

export function OddsBar({
  outcomes,
  odds,
  winningOutcomeId,
}: {
  outcomes: Outcome[];
  odds?: Record<string, number>;
  winningOutcomeId?: string | null;
}) {
  const hasData = odds && Object.keys(odds).length > 0;

  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        {outcomes.map((outcome, i) => {
          const pct = hasData ? (odds![outcome.id] ?? 0) * 100 : 100 / outcomes.length;
          return (
            <div
              key={outcome.id}
              className={`h-full transition-[width] duration-700 ease-out ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${!hasData ? "opacity-30" : ""}`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {outcomes.map((outcome, i) => (
          <span
            key={outcome.id}
            className={`flex items-center gap-1.5 ${winningOutcomeId === outcome.id ? "font-semibold text-accent-text" : ""}`}
          >
            <span className={`h-2 w-2 rounded-full ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`} />
            {outcome.label}
            {hasData && (
              <span className="font-mono tabular-nums">· {Math.round((odds![outcome.id] ?? 0) * 100)}%</span>
            )}
            {winningOutcomeId === outcome.id && " \u{1F3C6}"}
          </span>
        ))}
      </div>
    </div>
  );
}

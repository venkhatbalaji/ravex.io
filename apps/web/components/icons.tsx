type IconProps = { name: "fintech" | "ai" | "people" | "arrow" | "spark"; size?: number };

export function Icon({ name, size = 24 }: IconProps) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "fintech") return <svg {...common}><path d="M4 18V9m5 9V6m6 12V10m5 8V3"/><path d="m3 6 5-3 6 4 7-5"/></svg>;
  if (name === "ai") return <svg {...common}><rect x="5" y="5" width="14" height="14" rx="4"/><path d="M9 10h.01M15 10h.01M9 15c1.6 1.2 4.4 1.2 6 0M12 2v3M2 12h3M19 12h3"/></svg>;
  if (name === "people") return <svg {...common}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2"/><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M15 15c3 0 5 1.5 5.5 4"/></svg>;
  if (name === "spark") return <svg {...common}><path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Z"/></svg>;
  return <svg {...common}><path d="M5 12h14M14 7l5 5-5 5"/></svg>;
}


"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { api, type Market } from "@/lib/api";
import { OddsBar } from "@/components/odds-bar";
import { StatusBadge } from "@/components/status-badge";
import { HeroReveal } from "@/components/hero-reveal";
import { useCopy } from "@/context/branding-context";

export default function MarketsPage() {
  const { data: markets, isLoading } = useQuery({
    queryKey: ["markets"],
    queryFn: () => api.markets(),
    refetchInterval: 8000,
  });

  const eyebrow = useCopy("hero.eyebrow", "Live Markets");
  const heading1 = useCopy("hero.heading1", "Predict the match.");
  const heading2 = useCopy("hero.heading2", "Win the powerplay.");
  const subheading = useCopy(
    "hero.subheading",
    "Free coins, real pari-mutuel odds. Stake on an outcome before the market locks — the pool sets the price, not the house.",
  );
  const marketsHeading = useCopy("markets.heading", "All markets");
  const emptyState = useCopy("markets.emptyState", "No markets yet — check back soon.");

  return (
    <div className="space-y-10">
      <HeroReveal>
        <section className="flex items-center justify-between gap-8 pt-6">
          <div className="space-y-4">
            <p
              data-hero-item
              className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted"
            >
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" /> {eyebrow}
            </p>
            <h1
              data-hero-item
              className="font-display text-4xl leading-[0.95] font-semibold tracking-tight text-fg sm:text-5xl"
            >
              {heading1}
              <br />
              <span className="text-accent-2-text">{heading2}</span>
            </h1>
            <p data-hero-item className="max-w-lg text-sm leading-relaxed text-muted">
              {subheading}
            </p>
          </div>
          <Image
            data-hero-item
            src="/png/app-icon-master.png"
            alt=""
            width={1254}
            height={1254}
            priority
            className="animate-float hidden h-28 w-28 shrink-0 sm:block lg:h-36 lg:w-36"
          />
        </section>
      </HeroReveal>

      <h2 className="font-display text-xl font-medium text-fg" data-reveal>
        {marketsHeading}
      </h2>

      {isLoading && <p className="text-sm text-muted">Loading markets…</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {markets?.map((market, i) => (
          <MarketCard key={market.id} market={market} index={i} />
        ))}
      </div>

      {markets?.length === 0 && !isLoading && (
        <p data-reveal className="text-sm text-muted">
          {emptyState}
        </p>
      )}
    </div>
  );
}

function MarketCard({ market, index }: { market: Market; index: number }) {
  const { data: pool } = useQuery({
    queryKey: ["pool", market.id],
    queryFn: () => api.pool(market.id),
    refetchInterval: 6000,
    enabled: market.status !== "settled",
  });

  return (
    <Link
      href={`/markets/${market.id}`}
      data-reveal
      style={{ transitionDelay: `${Math.min(index, 6) * 60}ms` }}
      className="glow-accent group flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 transition hover:border-accent/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-medium text-fg">{market.title}</h3>
          <p className="mt-1 text-xs text-muted">{new Date(market.eventStartAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={market.status} />
      </div>
      <OddsBar outcomes={market.outcomes} odds={pool?.impliedOdds} winningOutcomeId={market.winningOutcomeId} />
      <p className="font-mono text-xs tabular-nums text-muted">{pool?.totalPool ?? 0} coins staked</p>
    </Link>
  );
}

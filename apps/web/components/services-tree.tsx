"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";

type Service = {
  number: string;
  icon: "fintech" | "ai" | "people";
  name: string;
  title: string;
  copy: string;
  tags: string[];
};

const HUB = { x: 600, y: 600 };
const TRUNK_START = { x: 600, y: 640 };

const BRANCHES: { tip: { x: number; y: number }; path: string; labelPos: "left" | "top" | "right" }[] = [
  { tip: { x: 220, y: 160 }, path: "M600,600 C520,420 340,360 220,160", labelPos: "left" },
  { tip: { x: 600, y: 60 }, path: "M600,600 C600,420 600,240 600,60", labelPos: "top" },
  { tip: { x: 980, y: 160 }, path: "M600,600 C680,420 860,360 980,160", labelPos: "right" },
];

export function ServicesTree({ services }: { services: Service[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trunkRef = useRef<SVGPathElement>(null);
  const branchRefs = useRef<(SVGPathElement | null)[]>([]);
  const ballRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Mobile drops the SVG tree entirely (see globals.css) — skip the pin+scrub
    // setup there too, or scrolling past this section would drag through 2200px
    // of dead space with nothing visibly animating.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 850px)").matches) return;

    // React Strict Mode (dev) mounts, unmounts, and remounts every component once,
    // running this effect's cleanup before the async import below has resolved —
    // without this guard the first ScrollTrigger/pin never gets torn down, and a
    // second one stacks on top of it (inflating the pin-spacer height).
    let cancelled = false;
    let ctx: ReturnType<typeof import("gsap")["gsap"]["context"]> | undefined;

    (async () => {
      const [{ gsap }, { ScrollTrigger }, { DrawSVGPlugin }, { MotionPathPlugin }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/DrawSVGPlugin"),
        import("gsap/MotionPathPlugin"),
      ]);
      gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin);

      if (cancelled || !sectionRef.current || !trunkRef.current) return;

      ctx = gsap.context(() => {
        const branches = branchRefs.current.filter((el): el is SVGPathElement => Boolean(el));
        const balls = ballRefs.current.filter((el): el is HTMLDivElement => Boolean(el));
        const cards = cardRefs.current.filter((el): el is HTMLDivElement => Boolean(el));

        gsap.set(trunkRef.current, { drawSVG: "0%" });
        gsap.set(branches, { drawSVG: "0%" });
        gsap.set(balls, { opacity: 0, scale: 0.4 });
        gsap.set(cards, { opacity: 0, y: 28 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "+=2200",
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
          },
        });

        tl.to(trunkRef.current, { drawSVG: "100%", duration: 1, ease: "none" });

        branches.forEach((branch, i) => {
          const ball = balls[i];
          const card = cards[i];
          tl.to(branch, { drawSVG: "100%", duration: 1.4, ease: "none" }, i === 0 ? ">" : "<0.35");
          if (ball) {
            tl.to(
              ball,
              {
                opacity: 1,
                scale: 1,
                duration: 1.4,
                ease: "none",
                motionPath: { path: branch, align: branch, alignOrigin: [0.5, 0.5] },
              },
              "<",
            );
          }
          if (card) {
            tl.to(card, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, ">-0.3");
          }
        });
      }, sectionRef);

      // The other stacked sections' "rises up from the bottom" entrance (statement,
      // approach, future, contact) is set up here too, deliberately in the same tick
      // right after the tree's pin above — not in a separate component. The tree's
      // pin:true just inserted a ~3000px+ pin-spacer that shifts everything below it
      // down the page; measuring those sections' positions before that insertion (which
      // is exactly what happened when this lived in its own effect in a sibling
      // component, racing this one) gives every trigger below the tree a stale,
      // way-too-early start/end. Doing it right here, after ctx above has run,
      // guarantees the DOM is already in its final shape when we measure it.
      if (cancelled) return;
      const otherHosts = Array.from(document.querySelectorAll<HTMLElement>(".pin-host"));
      ctx.add(() => {
        for (const host of otherHosts) {
          const panel = host.querySelector<HTMLElement>(".stack-panel");
          if (!panel) continue;

          // y only — no opacity fade. Each section has its own solid background sitting
          // directly on the plain page background (it's not layered over the previous
          // section), so fading its opacity let that page background show through as an
          // ugly grey wash blended with the section's own color mid-transition.
          gsap.fromTo(
            panel,
            { y: 180 },
            {
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: host,
                // Scrub the panel's actual entry — from its top edge first peeking up
                // over the viewport bottom, through to settling into its sticky spot
                // ("top top", when it locks in, is already fully on screen by then).
                start: "top bottom",
                end: "top top",
                scrub: 0.4,
              },
            },
          );
        }
      });
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <section className="services-tree" id="services" ref={sectionRef}>
      <div className="services-tree-intro" data-reveal>
        <div className="eyebrow"><span />Our expertise</div>
        <h2>Three disciplines.<br />One standard.</h2>
        <p>Deep domain thinking meets precise engineering. We partner from first idea to lasting impact.</p>
        <div className="scroll-hint"><i />Scroll to explore</div>
      </div>

      <svg className="services-tree-svg" viewBox="0 0 1200 640" fill="none" aria-hidden="true">
        <path
          ref={trunkRef}
          d={`M${TRUNK_START.x},${TRUNK_START.y} L${HUB.x},${HUB.y}`}
          className="services-tree-trunk"
        />
        {BRANCHES.map((branch, i) => (
          <path
            key={branch.labelPos}
            ref={(el) => { branchRefs.current[i] = el; }}
            d={branch.path}
            className="services-tree-branch"
          />
        ))}
        <circle cx={HUB.x} cy={HUB.y} r={10} className="services-tree-hub" />
      </svg>

      {BRANCHES.map((branch, i) => (
        <div
          key={branch.labelPos}
          ref={(el) => { ballRefs.current[i] = el; }}
          className="services-tree-ball"
          style={{ left: `${(branch.tip.x / 1200) * 100}%`, top: `${(branch.tip.y / 640) * 100}%` }}
        />
      ))}

      <div className="services-tree-cards">
        {services.map((service, i) => (
          <div
            key={service.name}
            ref={(el) => { cardRefs.current[i] = el; }}
            className={`services-tree-card services-tree-card-${BRANCHES[i].labelPos}`}
          >
            <div className="service-card-top">
              <div className="service-meta"><span>{service.number}</span><div className="service-icon"><Icon name={service.icon} size={22} /></div></div>
            </div>
            <h3>{service.name}</h3>
            <h4>{service.title}</h4>
            <p>{service.copy}</p>
            <div className="tags">{service.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

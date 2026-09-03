import Script from "next/script";
import { ContactForm } from "@/components/contact-form";
import { Footer } from "@/components/footer";
import { Icon } from "@/components/icons";
import { Nav } from "@/components/nav";
import { RevealController } from "@/components/reveal";

const services = [
  { number: "01", icon: "fintech" as const, name: "Fintech", title: "Finance, engineered for trust.", copy: "Secure digital banking, payments and financial platforms that simplify complexity and scale with confidence.", tags: ["Digital banking", "Payments", "Risk & compliance"] },
  { number: "02", icon: "ai" as const, name: "Artificial intelligence", title: "Intelligence that earns its place.", copy: "Practical AI systems that make teams faster, decisions sharper and customer experiences genuinely better.", tags: ["AI strategy", "Automation", "Data intelligence"] },
  { number: "03", icon: "people" as const, name: "People technology", title: "Better systems for better work.", copy: "Human-centred HR platforms that remove friction from hiring, operations and the employee experience.", tags: ["HR platforms", "Talent systems", "Workforce analytics"] },
];

export default function Home() {
  const jsonLd = { "@context": "https://schema.org", "@type": "Organization", name: "Ravex", url: "https://ravex.io", email: "hello@ravex.io", description: "Fintech, AI and HR technology solutions." };
  return <main><RevealController/><Script id="organization-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/><Nav/>
    <section className="hero">
      <div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/>
      <div className="eyebrow hero-eyebrow"><span/>Technology with purpose</div>
      <h1>Ideas engineered<br/>for <em>impact.</em></h1>
      <p className="hero-copy">We build fintech, AI and people solutions that turn ambitious thinking into meaningful progress.</p>
      <a href="#services" className="text-link">Explore our expertise <Icon name="arrow" size={19}/></a>
      <div className="scroll-cue"><span>Scroll to discover</span><i/></div>
      <div className="hero-index">R / 001</div>
    </section>

    <section className="statement section-pad" data-reveal><div className="eyebrow"><span/>What we believe</div><p>Technology should do more than work.<br/>It should <em>move you forward.</em></p></section>

    <section className="services section-pad" id="services">
      <div className="section-heading" data-reveal><div><div className="eyebrow"><span/>Our expertise</div><h2>Three disciplines.<br/>One standard.</h2></div><p>Deep domain thinking meets precise engineering. We partner from first idea to lasting impact.</p></div>
      <div className="service-list">{services.map((service) => <article className="service-card" key={service.name} data-reveal>
        <div className="service-meta"><span>{service.number}</span><div className="service-icon"><Icon name={service.icon} size={28}/></div></div>
        <div><h3>{service.name}</h3><h4>{service.title}</h4><p>{service.copy}</p><div className="tags">{service.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
        <a href="#contact" aria-label={`Discuss ${service.name}`}><Icon name="arrow"/></a>
      </article>)}</div>
    </section>

    <section className="approach" id="approach"><div className="approach-visual"><div className="rings"><span/><span/><span/><div>R</div></div><p>Clarity at the centre.<br/>Progress in every direction.</p></div><div className="approach-copy" data-reveal><div className="eyebrow light"><span/>How we work</div><h2>Built around<br/>your <em>reality.</em></h2><p>We don’t arrive with a fixed answer. We listen, challenge and shape the right solution around your business—not the other way around.</p><ol><li><b>01</b><span><strong>Understand deeply</strong>We get close to the problem, the people and the context.</span></li><li><b>02</b><span><strong>Think precisely</strong>We turn complexity into a clear, focused direction.</span></li><li><b>03</b><span><strong>Build responsibly</strong>We create secure, scalable systems made to last.</span></li></ol></div></section>

    <section className="future section-pad" data-reveal><div className="future-label"><Icon name="spark" size={18}/> From the Ravex lab</div><div><h2>We’re building<br/>what comes <em>next.</em></h2><p>Original products shaped by the same problems we solve every day.</p><a href="/products" className="text-link dark">See what’s coming <Icon name="arrow" size={19}/></a></div><div className="product-tease"><span>01 — PRIVATE BETA</span><div className="tease-mark">rv<span>•</span></div><h3>A smarter way<br/>to understand work.</h3><div className="coming-pill"><i/> Revealing soon</div></div></section>

    <section className="contact section-pad" id="contact"><div className="contact-copy" data-reveal><div className="eyebrow light"><span/>Let’s talk</div><h2>Have a problem<br/>worth <em>solving?</em></h2><p>Tell us where you want to go. We’ll bring the questions, clarity and craft to help you get there.</p><a href="mailto:hello@ravex.io">hello@ravex.io <Icon name="arrow" size={18}/></a></div><ContactForm/></section>
    <Footer/>
  </main>;
}

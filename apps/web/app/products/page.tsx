import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";

export const metadata: Metadata = { title: "Products", description: "See what the Ravex lab is building next.", alternates: { canonical: "/products" } };

export default function ProductsPage() {
  return <main className="inner-page"><Nav/><section className="products-hero"><div className="eyebrow light"><span/>Ravex lab / 001</div><h1>Something useful<br/>is taking <em>shape.</em></h1><p>We’re turning a familiar workplace problem into a focused new product. Quietly testing. Carefully refining. Revealing soon.</p><div className="launch-status"><i/><span>Private beta in progress</span></div><a href="mailto:hello@ravex.io?subject=Ravex%20product%20early%20access">Request early access ↗</a></section><section className="product-principles"><span>Built on three principles</span><div><article><b>01</b><h2>Useful from day one.</h2><p>No transformation theatre. Real value for real teams.</p></article><article><b>02</b><h2>Human by design.</h2><p>Intelligence that supports judgment, rather than replacing it.</p></article><article><b>03</b><h2>Trust at the core.</h2><p>Thoughtful privacy and security from the first line of code.</p></article></div></section><Footer/></main>;
}


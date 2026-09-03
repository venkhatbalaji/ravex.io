"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./logo";

export function Nav() {
  const [open, setOpen] = useState(false);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  return (
    <header className="site-header">
      <Logo />
      <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle navigation"><span/><span/></button>
      <nav className={open ? "nav-links open" : "nav-links"} aria-label="Main navigation">
        <Link href="/#services" onClick={() => setOpen(false)}>Expertise</Link>
        <Link href="/#approach" onClick={() => setOpen(false)}>Approach</Link>
        <Link href="/products" onClick={() => setOpen(false)}>Products</Link>
        <Link href="/#contact" className="nav-cta" onClick={() => setOpen(false)}>Start a project <span>↗</span></Link>
      </nav>
    </header>
  );
}

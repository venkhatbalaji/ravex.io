"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";
import { authClient, useSession } from "@/lib/auth-client";

export function Nav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <Logo />
      <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle navigation"><span/><span/></button>
      <nav className={open ? "nav-links open" : "nav-links"} aria-label="Main navigation">
        <Link href="/#services" onClick={() => setOpen(false)}>Expertise</Link>
        <Link href="/#approach" onClick={() => setOpen(false)}>Approach</Link>
        <Link href="/products" onClick={() => setOpen(false)}>Products</Link>
        {session ? (
          <>
            <Link href="/chat" onClick={() => setOpen(false)}>Chat</Link>
            <button className="nav-cta" onClick={handleSignOut}>Sign out</button>
          </>
        ) : (
          <Link href="/sign-in" className="nav-cta" onClick={() => setOpen(false)}>Sign in <span>↗</span></Link>
        )}
      </nav>
    </header>
  );
}

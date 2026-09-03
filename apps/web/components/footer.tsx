import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return <footer><div className="footer-main"><Logo/><p>Technology with purpose.<br/>Built for what’s next.</p><div className="footer-links"><div><span>Navigate</span><Link href="/#services">Expertise</Link><Link href="/#approach">Approach</Link><Link href="/products">Products</Link></div><div><span>Connect</span><a href="mailto:hello@ravex.io">hello@ravex.io</a><a href="https://www.linkedin.com" rel="noreferrer">LinkedIn ↗</a></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Ravex. All rights reserved.</span><Link href="/privacy">Privacy</Link><span>Designed to move forward.</span></div></footer>;
}

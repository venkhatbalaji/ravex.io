"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/categories", label: "Categories" },
  { href: "/branding", label: "Branding" },
];

export function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!isAuthenticated) return null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="text-sm font-semibold tracking-tight text-fg">Predict Play · Admin</span>
          <nav className="hidden items-center gap-5 text-sm text-muted sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition hover:text-fg ${pathname.startsWith(link.href) ? "text-fg" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">{user?.email}</span>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
          >
            Log out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

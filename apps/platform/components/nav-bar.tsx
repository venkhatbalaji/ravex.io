"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { useCountUp } from "./use-count-up";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { useCopy } from "@/context/branding-context";

export function NavBar() {
  const { isAuthenticated, user, token, logout } = useAuth();
  const router = useRouter();
  const linkMarkets = useCopy("nav.linkMarkets", "Markets");
  const linkWallet = useCopy("nav.linkWallet", "Wallet");
  const logInLabel = useCopy("nav.logIn", "Log in");
  const registerLabel = useCopy("nav.register", "Register");
  const logOutLabel = useCopy("nav.logOut", "Log out");
  const { data } = useQuery({
    queryKey: ["balance", token],
    queryFn: () => api.balance(token!),
    enabled: Boolean(token),
    refetchInterval: 10000,
  });
  const displayBalance = useCountUp(data?.balance ?? 0);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
          <Link href="/" className="transition hover:text-fg">
            {linkMarkets}
          </Link>
          {isAuthenticated && (
            <Link href="/wallet" className="transition hover:text-fg">
              {linkWallet}
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="rounded-full bg-accent/10 px-3 py-1 font-mono text-xs font-semibold tabular-nums text-accent-text">
                {displayBalance} coins
              </span>
              <span className="hidden text-xs text-muted sm:inline">{user?.email}</span>
              <button
                onClick={() => {
                  logout();
                  router.push("/login");
                }}
                className="rounded-full border border-border-strong px-3 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-fg"
              >
                {logOutLabel}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-xs text-muted transition hover:text-fg">
                {logInLabel}
              </Link>
              <Link
                href="/register"
                className="glow-accent rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-fg transition hover:opacity-90"
              >
                {registerLabel}
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

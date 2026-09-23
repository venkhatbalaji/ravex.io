"use client";

import { useEffect, useRef, useState } from "react";

export type SessionStatus = "checking" | "authenticated" | "anonymous" | "unavailable";
interface SessionState<User> {
  token: string | null;
  user: User | null;
  status: SessionStatus;
  notice: string | null;
  epoch: number;
}
interface SessionOptions<User> {
  storageKey: string;
  loadUser: (token: string, signal: AbortSignal) => Promise<User>;
  acceptUser?: (user: User) => boolean;
  onSessionChange: () => void;
}
interface RequestSession {
  requestIdentity(token: string): number | null;
  unauthorized(token: string, requestId: number | null): void;
}
let activeSession: RequestSession | null = null;
let nextEpoch = 0;

// Capture before sending, so even an old response for an identical reissued
// JWT cannot clear a newer login. These identifiers never leave the browser.
export function sessionRequestIdentity(token: string): number | null {
  return activeSession?.requestIdentity(token) ?? null;
}
export function reportUnauthorized(token: string, requestId: number | null) {
  activeSession?.unauthorized(token, requestId);
}

function expiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const encoded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    return Number.isSafeInteger(exp) && exp > 0 && Number.isSafeInteger(exp * 1000) ? exp * 1000 : 0;
  } catch { return 0; }
}

class BrowserSession<User> implements RequestSession {
  private active = false;
  private token: string | null = null;
  private epoch = 0;
  private status: SessionStatus = "checking";
  private memoryOnly = false;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private verification?: AbortController;

  constructor(private options: SessionOptions<User>, private publish: (state: SessionState<User>) => void) {}

  requestIdentity(token: string) { return this.token === token ? this.epoch : null; }
  unauthorized(token: string, requestId: number | null) {
    if (requestId !== null && requestId === this.epoch && token === this.token)
      this.clear("Your session has expired. Please sign in again.");
  }

  private transition(token: string | null, user: User | null, notice: string | null) {
    this.verification?.abort();
    this.verification = undefined;
    clearTimeout(this.expiryTimer);
    this.options.onSessionChange();
    this.token = token;
    this.epoch = ++nextEpoch;
    this.status = token ? (user ? "authenticated" : "checking") : "anonymous";
    this.publish({ token: user ? token : null, user, status: this.status, notice, epoch: this.epoch });
    if (token) this.scheduleExpiry();
  }

  private scheduleExpiry() {
    const token = this.token;
    if (!token) return;
    const remaining = expiry(token) - Date.now();
    if (remaining <= 0) { this.clear("Your session has expired. Please sign in again."); return; }
    const epoch = this.epoch;
    this.expiryTimer = setTimeout(() => {
      if (this.active && epoch === this.epoch) this.scheduleExpiry();
    }, Math.min(remaining, 2_147_483_647));
  }

  private clear(notice: string | null = null) {
    const oldToken = this.token;
    this.memoryOnly = false;
    try {
      // Never erase another tab's newer login with an old response or timer.
      if (localStorage.getItem(this.options.storageKey) === oldToken)
        localStorage.removeItem(this.options.storageKey);
    } catch {
      // A failed removal must not restore the logged-out session on focus.
      this.memoryOnly = true;
    }
    this.transition(null, null, notice);
  }

  private async verify() {
    const token = this.token;
    if (!token || this.verification) return;
    if (expiry(token) <= Date.now()) { this.clear("Your session has expired. Please sign in again."); return; }
    const epoch = this.epoch;
    const controller = new AbortController();
    this.verification = controller;
    this.status = "checking";
    this.publish({ token: null, user: null, status: this.status, notice: null, epoch });
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const user = await this.options.loadUser(token, controller.signal);
      if (!this.active || epoch !== this.epoch) return;
      if (expiry(token) <= Date.now()) { this.clear("Your session has expired. Please sign in again."); return; }
      if (this.options.acceptUser && !this.options.acceptUser(user)) {
        this.clear("This account no longer has admin access."); return;
      }
      this.status = "authenticated";
      this.publish({ token, user, status: this.status, notice: null, epoch });
    } catch (error) {
      if (!this.active || epoch !== this.epoch) return;
      if ((error as { status?: number } | null)?.status === 401) {
        this.clear("Your session has expired. Please sign in again."); return;
      }
      this.status = "unavailable";
      this.publish({ token: null, user: null, status: this.status,
        notice: "Cannot verify your saved session right now. Please try again.", epoch });
    } finally {
      clearTimeout(timeout);
      if (this.verification === controller) this.verification = undefined;
    }
  }

  private restore(token: string | null) {
    this.memoryOnly = false;
    this.transition(token, null, null);
    void this.verify();
  }

  private synchronize = () => {
    if (!this.active) return;
    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (!this.memoryOnly && stored !== this.token) { this.restore(stored); return; }
    } catch { /* Keep an already loaded session usable for this tab. */ }
    if (this.token && expiry(this.token) <= Date.now()) {
      this.clear("Your session has expired. Please sign in again."); return;
    }
    if (this.status === "unavailable") void this.verify();
  };
  private storageChanged = (event: StorageEvent) => {
    try {
      if (event.storageArea === localStorage && (event.key === this.options.storageKey || event.key === null))
        this.synchronize();
    } catch { /* Storage access can be disabled while this tab is open. */ }
  };
  private visibilityChanged = () => { if (document.visibilityState === "visible") this.synchronize(); };

  start() {
    this.active = true;
    activeSession = this;
    window.addEventListener("storage", this.storageChanged);
    window.addEventListener("focus", this.synchronize);
    window.addEventListener("online", this.synchronize);
    document.addEventListener("visibilitychange", this.visibilityChanged);
    try { this.restore(localStorage.getItem(this.options.storageKey)); }
    catch { this.transition(null, null, "Browser storage is unavailable. You can sign in for this tab."); }
  }
  stop() {
    this.active = false;
    this.verification?.abort();
    clearTimeout(this.expiryTimer);
    if (activeSession === this) activeSession = null;
    window.removeEventListener("storage", this.storageChanged);
    window.removeEventListener("focus", this.synchronize);
    window.removeEventListener("online", this.synchronize);
    document.removeEventListener("visibilitychange", this.visibilityChanged);
  }
  logout = () => { this.clear(); };
  retry = () => { void this.verify(); };

  async signIn(authenticate: () => Promise<{ accessToken: string; user: User }>) {
    this.clear();
    const epoch = this.epoch;
    const result = await authenticate();
    if (!this.active || epoch !== this.epoch) throw new Error("Sign-in was cancelled. Please try again.");
    if (this.options.acceptUser && !this.options.acceptUser(result.user))
      throw new Error("This account doesn't have admin access.");
    if (expiry(result.accessToken) <= Date.now()) throw new Error("The session has expired. Please sign in again.");
    let notice: string | null = null;
    try {
      localStorage.setItem(this.options.storageKey, result.accessToken);
      this.memoryOnly = false;
    }
    catch {
      this.memoryOnly = true;
      notice = "You are signed in for this tab only because browser storage is unavailable.";
    }
    this.transition(result.accessToken, result.user, notice);
  }
}

export function useBrowserSession<User>({ storageKey, loadUser, acceptUser, onSessionChange }: SessionOptions<User>) {
  const [state, setState] = useState<SessionState<User>>({ token: null, user: null, status: "checking", notice: null, epoch: 0 });
  const controller = useRef<BrowserSession<User> | null>(null);
  useEffect(() => {
    const session = new BrowserSession({ storageKey, loadUser, acceptUser, onSessionChange }, setState);
    controller.current = session;
    session.start();
    return () => { session.stop(); if (controller.current === session) controller.current = null; };
  }, [storageKey, loadUser, acceptUser, onSessionChange]);
  return {
    ...state,
    isAuthenticated: state.status === "authenticated",
    isLoading: state.status === "checking",
    logout: () => controller.current?.logout(),
    retrySession: () => controller.current?.retry(),
    signIn: (authenticate: () => Promise<{ accessToken: string; user: User }>) => {
      if (!controller.current) return Promise.reject(new Error("Session is still loading. Please try again."));
      return controller.current.signIn(authenticate);
    },
  };
}

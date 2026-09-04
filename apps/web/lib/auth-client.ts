"use client";

import { createAuthClient } from "better-auth/react";

// No explicit baseURL — Better Auth then defaults to the relative path "/api/auth",
// which the browser resolves against whatever origin actually served the page. Pinning
// this to a fixed domain (e.g. via NEXT_PUBLIC_SITE_URL) caused CORS failures whenever
// the serving domain didn't match exactly (e.g. www.ravex.io vs ravex.io).
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;

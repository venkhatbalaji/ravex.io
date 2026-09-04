"use client";

import { createAuthClient } from "better-auth/react";
import { getSiteUrl } from "@/lib/site-url";

export const authClient = createAuthClient({ baseURL: getSiteUrl() });

export const { signIn, signUp, signOut, useSession } = authClient;

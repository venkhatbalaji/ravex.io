import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import { getDb } from "@/db";
import * as schema from "@/db/schema";

// Only enabled once RECAPTCHA_SECRET_KEY is set, so local dev keeps working before a
// reCAPTCHA site is registered. Defaults already cover /sign-up/email, /sign-in/email
// and /request-password-reset — see node_modules/better-auth/dist/plugins/captcha/constants.mjs.
//
// This is a v2 checkbox site (not v3): its verify response carries no `score`/`action`
// fields, so `minScore`/`expectedAction` are deliberately left unset — the plugin's own
// verify handler only enforces those when they're present in the response, but setting
// expectedAction here would reject every v2 response outright (it always fails the
// `action !== expectedAction` check when the response has no `action` at all).
const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [
    ...(recaptchaSecretKey ? [captcha({ provider: "google-recaptcha", secretKey: recaptchaSecretKey })] : []),
    nextCookies(),
  ],
});

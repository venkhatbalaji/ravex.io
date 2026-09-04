import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to your Ravex account.", alternates: { canonical: "/sign-in" } };

export default function SignInPage() {
  return (
    <main className="inner-page">
      <Nav />
      <section className="auth-page">
        <div className="eyebrow light"><span />Welcome back</div>
        <h1>Good to<br />see you <em>again.</em></h1>
        <Suspense>
          <SignInForm />
        </Suspense>
      </section>
      <Footer />
    </main>
  );
}

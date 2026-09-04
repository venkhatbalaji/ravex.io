import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { SignUpForm } from "@/components/sign-up-form";

export const metadata: Metadata = { title: "Sign up", description: "Create a Ravex account to start chatting.", alternates: { canonical: "/sign-up" } };

export default function SignUpPage() {
  return (
    <main className="inner-page">
      <Nav />
      <section className="auth-page">
        <div className="eyebrow light"><span />Create account</div>
        <h1>Let’s get<br />you <em>set up.</em></h1>
        <SignUpForm />
      </section>
      <Footer />
    </main>
  );
}

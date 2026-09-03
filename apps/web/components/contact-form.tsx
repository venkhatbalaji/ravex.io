"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setMessage("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/inquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
      setStatus("success"); form.reset();
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Please try again."); }
  }

  if (status === "success") return <div className="form-success" role="status"><span>✓</span><h3>It’s in good hands.</h3><p>Thanks for reaching out. Our team will reply within one business day.</p><button onClick={() => setStatus("idle")}>Send another note</button></div>;

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="field-row"><label>First name<input name="firstName" required autoComplete="given-name" placeholder="Alex" maxLength={80}/></label><label>Last name<input name="lastName" required autoComplete="family-name" placeholder="Morgan" maxLength={80}/></label></div>
      <label>Work email<input type="email" name="email" required autoComplete="email" placeholder="alex@company.com" maxLength={180}/></label>
      <label>What can we build together?<select name="service" required defaultValue=""><option value="" disabled>Select a service</option><option value="fintech">Fintech platforms</option><option value="ai">AI solutions</option><option value="hr">HR technology</option><option value="other">Something else</option></select></label>
      <label>Tell us a little more<textarea name="message" required placeholder="Your challenge, idea or goal…" rows={4} maxLength={2000}/></label>
      <input name="website" tabIndex={-1} autoComplete="off" className="honey" aria-hidden="true"/>
      <button className="submit-button" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send inquiry"}<span>↗</span></button>
      {status === "error" && <p className="form-error" role="alert">{message}</p>}
      <p className="form-note">By submitting, you agree to our <a href="/privacy">privacy policy</a>.</p>
    </form>
  );
}


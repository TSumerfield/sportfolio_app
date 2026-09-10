"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("Enter your email to start using Sportfolio.");
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const explicitSignIn = params.get("signin") === "1";
    const accessRequired = params.get("access") === "required";

    if (!explicitSignIn && !accessRequired) {
      window.location.replace("/");
      return;
    }

    if (accessRequired) setStatus("Please sign in again to continue to Sportfolio.");
    setReady(true);
  }, []);

  async function sendLink(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setStatus("Enter a valid email address.");
      return;
    }
    setSending(true);
    setStatus("Sending your secure sign-in link…");
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Check your email. Open the Sportfolio sign-in link on this device.");
  }

  if (!ready) return <main className="login-page" aria-busy="true" />;

  return <main className="login-page">
    <section className="login-panel">
      <a className="login-brand" href="/"><span>S</span> SPORTFOLIO</a>
      <div className="login-copy"><small>PRIVATE PE EVIDENCE · PILOT</small><h1>Start using Sportfolio.</h1><p>Enter your email to receive a secure sign-in link. No password to remember. After signing in, create your classes, add pupils and start capturing evidence.</p></div>
      <form onSubmit={sendLink} className="login-form"><label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" disabled={sending} /></label><button disabled={sending}>{sending ? "Sending…" : "Send secure sign-in link"}</button></form>
      <p className="login-status" role="status">{status}</p>
      <div className="login-trust"><span>Private media</span><span>5-class pilot</span><span>iPad first</span></div>
    </section>
    <section className="login-side"><div><small>CAPTURE STUDIO</small><strong>Classes → pupils → capture → save.</strong><p>Built to keep the teacher in the lesson, not at a desk.</p></div></section>
  </main>;
}

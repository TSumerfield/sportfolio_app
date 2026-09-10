"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState("Enter your email to start using Sportfolio.");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
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

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setStatus("Enter a valid email address.");
      return;
    }
    setSending(true);
    setStatus("Sending your one-time sign-in code…");
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setCodeSent(true);
    setStatus("Check your email for the 6-digit code, then enter it below.");
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    const token = otp.trim();
    if (token.length < 6) {
      setStatus("Enter the 6-digit code from your email.");
      return;
    }
    setVerifying(true);
    setStatus("Signing you in…");
    const { error } = await supabase.auth.verifyOtp({
      email: normalized,
      token,
      type: "email",
    });
    setVerifying(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    window.location.replace("/live/setup");
  }

  if (!ready) return <main className="login-page" aria-busy="true" />;

  return <main className="login-page">
    <section className="login-panel">
      <a className="login-brand" href="/"><span>S</span> SPORTFOLIO</a>
      <div className="login-copy"><small>PRIVATE PE EVIDENCE · PILOT</small><h1>Start using Sportfolio.</h1><p>Enter your email and we’ll send you a one-time 6-digit code. Enter the code on this page to sign in, then create classes, add pupils and start capturing evidence.</p></div>
      {!codeSent ? (
        <form onSubmit={sendCode} className="login-form">
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" disabled={sending} /></label>
          <button disabled={sending}>{sending ? "Sending…" : "Send sign-in code"}</button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="login-form">
          <label>Email address<input type="email" value={email} disabled /></label>
          <label>6-digit code<input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="123456" disabled={verifying} /></label>
          <button disabled={verifying}>{verifying ? "Signing in…" : "Sign in"}</button>
          <button type="button" onClick={() => { setCodeSent(false); setOtp(""); setStatus("Enter your email to start using Sportfolio."); }} disabled={verifying}>Use a different email</button>
        </form>
      )}
      <p className="login-status" role="status">{status}</p>
      <div className="login-trust"><span>Private media</span><span>5-class pilot</span><span>iPad first</span></div>
    </section>
    <section className="login-side"><div><small>CAPTURE STUDIO</small><strong>Classes → pupils → capture → save.</strong><p>Built to keep the teacher in the lesson, not at a desk.</p></div></section>
  </main>;
}

"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for the secure Sportfolio sign-in link.");
  }

  return <main className="login-shell">
    <section className="login-brand">
      <div className="login-logo"><span className="login-mark">S</span><span>SPORTFOLIO</span></div>
      <div>
        <p className="login-kicker">CAPTURE / REFLECT / GROW</p>
        <h1>Make learning visible.</h1>
        <p>Fast evidence capture for PE teachers. Simple reflection for pupils.</p>
      </div>
    </section>
    <section className="login-panel">
      <form onSubmit={submit} className="login-card">
        <span className="login-chip">SECURE ACCESS</span>
        <h2>Sign in to Sportfolio</h2>
        <p>Use your registered pilot email. We’ll send you a secure magic link.</p>
        <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.org" /></label>
        <button disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send sign-in link"}</button>
        {message && <div className={`login-message ${status}`}>{message}</div>}
        <small>New accounts cannot be created from this screen.</small>
      </form>
    </section>
  </main>;
}

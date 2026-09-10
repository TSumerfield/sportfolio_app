"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Securing your Sportfolio session…");

  useEffect(() => {
    let cancelled = false;

    async function waitForSession(timeoutMs = 10000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return null;
    }

    async function resolveDestination(userId: string) {
      const [{ data: student, error: studentError }, { data: teacherClass, error: teacherError }] = await Promise.all([
        supabase.from("sportfolio_students").select("id").eq("auth_user_id", userId).maybeSingle(),
        supabase.from("sportfolio_classes").select("id").eq("teacher_user_id", userId).limit(1).maybeSingle(),
      ]);

      if (studentError) throw studentError;
      if (teacherError) throw teacherError;
      if (student) return "/student";
      return teacherClass ? "/live" : "/live/setup";
    }

    async function finish() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const authError = url.searchParams.get("error_description") || hash.get("error_description");
      if (authError) {
        setMessage(`Sign-in link failed: ${authError}`);
        return;
      }

      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage("This sign-in link could not be exchanged. Request a fresh link after this deployment.");
          return;
        }
      }

      const session = await waitForSession();
      if (cancelled) return;
      if (!session) {
        setMessage("The email was confirmed, but no browser session was created. Request one fresh sign-in link and open it in this browser.");
        return;
      }

      try {
        const destination = await resolveDestination(session.user.id);
        if (cancelled) return;
        window.history.replaceState({}, document.title, "/auth/callback");
        window.location.replace(destination);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "We could not open your Sportfolio workspace. Please try again.");
        }
      }
    }

    void finish();
    return () => { cancelled = true; };
  }, []);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#123f32",color:"white",fontFamily:"Manrope,Arial"}}>
    <div style={{textAlign:"center",padding:32,maxWidth:560}}><div style={{fontSize:42,color:"#d8ff6a",fontWeight:900,fontStyle:"italic"}}>S</div><h1>SPORTFOLIO</h1><p style={{color:"#c6d1cc",lineHeight:1.6}}>{message}</p></div>
  </main>;
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Securing your Sportfolio session…");

  useEffect(() => {
    let cancelled = false;

    async function waitForSession() {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
        await new Promise((resolve) => setTimeout(resolve, 150));
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
      if (teacherClass) return "/live";
      return null;
    }

    async function finish() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) setMessage("We could not complete sign-in. Request a new link.");
          return;
        }
        window.history.replaceState({}, document.title, "/auth/callback");
      }

      const session = await waitForSession();
      if (cancelled) return;
      if (!session) {
        setMessage("Your sign-in completed, but the session did not load. Please try the link again.");
        return;
      }

      try {
        const destination = await resolveDestination(session.user.id);
        if (cancelled) return;
        if (!destination) {
          await supabase.auth.signOut();
          setMessage("This account is not assigned to a Sportfolio class or pupil yet.");
          return;
        }
        window.location.replace(destination);
      } catch {
        if (!cancelled) setMessage("We could not confirm your Sportfolio access. Please try signing in again.");
      }
    }

    finish();
    return () => { cancelled = true; };
  }, []);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#050505",color:"white",fontFamily:"Manrope,Arial"}}>
    <div style={{textAlign:"center",padding:32}}><div style={{fontSize:42,color:"#ff5a00",fontWeight:900,fontStyle:"italic"}}>S</div><h1>SPORTFOLIO</h1><p style={{color:"#aaa"}}>{message}</p></div>
  </main>;
}

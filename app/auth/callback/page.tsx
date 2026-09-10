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

    async function resolveDestination(userId: string, email: string | undefined) {
      const normalizedEmail = email?.trim().toLowerCase();

      const studentQuery = supabase
        .from("sportfolio_students")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      const accessQuery = normalizedEmail
        ? supabase
            .from("sportfolio_pilot_access")
            .select("id")
            .eq("email", normalizedEmail)
            .eq("active", true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const teacherClassQuery = supabase
        .from("sportfolio_classes")
        .select("id")
        .eq("teacher_user_id", userId)
        .limit(1)
        .maybeSingle();

      const [studentResult, accessResult, teacherClassResult] = await Promise.all([
        studentQuery,
        accessQuery,
        teacherClassQuery,
      ]);

      if (studentResult.error) throw studentResult.error;
      if (accessResult.error) throw accessResult.error;
      if (teacherClassResult.error) throw teacherClassResult.error;

      if (studentResult.data) return "/student";
      if (accessResult.data) return teacherClassResult.data ? "/live" : "/live/setup";
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
        setMessage("Your sign-in completed, but the session did not load. Please request a fresh link.");
        return;
      }

      try {
        const destination = await resolveDestination(session.user.id, session.user.email);
        if (cancelled) return;
        if (!destination) {
          await supabase.auth.signOut();
          window.location.replace("/login?access=required");
          return;
        }
        window.location.replace(destination);
      } catch {
        if (!cancelled) setMessage("We could not confirm your Sportfolio access. Please try signing in again.");
      }
    }

    void finish();
    return () => { cancelled = true; };
  }, []);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#123f32",color:"white",fontFamily:"Manrope,Arial"}}>
    <div style={{textAlign:"center",padding:32}}><div style={{fontSize:42,color:"#d8ff6a",fontWeight:900,fontStyle:"italic"}}>S</div><h1>SPORTFOLIO</h1><p style={{color:"#c6d1cc"}}>{message}</p></div>
  </main>;
}

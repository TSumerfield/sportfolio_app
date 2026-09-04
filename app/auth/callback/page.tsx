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
        if (data.session) return true;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      return false;
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

      const ready = await waitForSession();
      if (cancelled) return;
      if (!ready) {
        setMessage("Your sign-in completed, but the session did not load. Please try the link again.");
        return;
      }

      window.location.replace("/live");
    }

    finish();
    return () => { cancelled = true; };
  }, []);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#050505",color:"white",fontFamily:"Manrope,Arial"}}>
    <div style={{textAlign:"center",padding:32}}><div style={{fontSize:42,color:"#ff5a00",fontWeight:900,fontStyle:"italic"}}>S</div><h1>SPORTFOLIO</h1><p style={{color:"#aaa"}}>{message}</p></div>
  </main>;
}

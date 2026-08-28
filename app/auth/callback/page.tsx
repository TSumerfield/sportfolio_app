"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Securing your Sportfolio session…");

  useEffect(() => {
    async function finish() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          window.location.replace("/live");
          return;
        }
        setMessage("This sign-in link is invalid or has expired.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage("We could not complete sign-in. Request a new link.");
        return;
      }
      window.location.replace("/live");
    }
    finish();
  }, []);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#050505",color:"white",fontFamily:"Manrope,Arial"}}>
    <div style={{textAlign:"center",padding:32}}><div style={{fontSize:42,color:"#ff5a00",fontWeight:900,fontStyle:"italic"}}>S</div><h1>SPORTFOLIO</h1><p style={{color:"#aaa"}}>{message}</p></div>
  </main>;
}

"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    // /login is a legacy pilot entry point. Always hand off to the current
    // Sportfolio entry route so old iPad bookmarks do not strand teachers on
    // an obsolete authentication screen.
    window.location.replace("/");
  }, []);

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f2e8",color:"#123f32",fontFamily:"Manrope,Arial",padding:24,textAlign:"center"}}>
      <div>
        <strong style={{display:"block",fontSize:28,letterSpacing:"0.04em",marginBottom:10}}>SPORTFOLIO</strong>
        <span>Opening the current Sportfolio workspace…</span>
        <div style={{marginTop:16}}><a href="/" style={{color:"#123f32",fontWeight:800}}>Continue to Sportfolio</a></div>
      </div>
    </main>
  );
}

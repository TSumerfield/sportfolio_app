"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f2e8",color:"#123f32",fontFamily:"Manrope,Arial"}}>
      Sportfolio is in active build.
    </main>
  );
}

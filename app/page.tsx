"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase/client";

export default function Home() {
  useEffect(() => {
    let cancelled = false;

    async function route() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        window.location.replace("/login");
        return;
      }

      const [{ data: student }, { data: teacherClass }] = await Promise.all([
        supabase.from("sportfolio_students").select("id").eq("auth_user_id", user.id).maybeSingle(),
        supabase.from("sportfolio_classes").select("id").eq("teacher_user_id", user.id).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;

      if (student) window.location.replace("/student");
      else if (teacherClass) window.location.replace("/live");
      else {
        await supabase.auth.signOut();
        window.location.replace("/login");
      }
    }

    route();
    return () => { cancelled = true; };
  }, []);

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#050505",color:"white",fontFamily:"Manrope,Arial"}}>Opening Sportfolio…</main>;
}

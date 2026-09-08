"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase/client";

export default function LiveLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    let active = true;
    async function guard() {
      const { data } = await supabase.auth.getSession();
      if (active && !data.session) window.location.replace("/login");
    }
    void guard();
    return () => { active = false; };
  }, []);

  return <>{children}<nav className="live-shortcuts" aria-label="Sportfolio quick actions"><a className="setup-launch" href="/live/setup">Classes</a><a className="session-launch" href="/live/session">Session Capture</a><a className="review-launch" href="/live/review">Review</a><a className="coverage-launch" href="/live/coverage">Coverage</a></nav><style>{`.live-shortcuts{position:fixed;right:18px;bottom:18px;z-index:80;display:flex;gap:8px;align-items:center}.setup-launch,.session-launch,.review-launch,.coverage-launch{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:999px;padding:11px 15px;font:800 11px Manrope;box-shadow:0 8px 24px #0002}.setup-launch{background:#fffdf7;color:#123f32;border:1px solid #c9c4b8}.session-launch{background:#d8ff6a;color:#123f32;border:1px solid #b9df4c}.review-launch{background:#f4f1e8;color:#123f32;border:1px solid #c9c4b8}.coverage-launch{background:#123f32;color:#fff;border:1px solid #ffffff33}.setup-launch:hover,.review-launch:hover{background:#fff}.session-launch:hover{background:#c9f052}.coverage-launch:hover{background:#1d5645}.setup-launch:focus-visible,.session-launch:focus-visible,.review-launch:focus-visible,.coverage-launch:focus-visible{outline:3px solid #d8ff6a;outline-offset:3px}@media(max-width:760px){.live-shortcuts{right:14px;bottom:14px;left:14px;justify-content:flex-end}.setup-launch,.session-launch,.review-launch,.coverage-launch{padding:10px 13px}.coverage-launch{display:none}}`}</style></>;
}

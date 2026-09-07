"use client";

import { useEffect } from "react";

export default function OpenSportfolioMobileRouter() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const link = target?.closest('a[href="/live"]') as HTMLAnchorElement | null;
      if (!link || !window.matchMedia("(max-width: 760px)").matches) return;

      event.preventDefault();
      window.location.assign("/live/session");
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return <style>{`
    @media (max-width:760px){
      a[href="/live"]{position:relative!important;z-index:30!important;pointer-events:auto!important;touch-action:manipulation!important}
    }
  `}</style>;
}

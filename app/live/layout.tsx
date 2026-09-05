import type { ReactNode } from "react";

export default function LiveLayout({ children }: { children: ReactNode }) {
  return <>{children}<a className="coverage-launch" href="/live/coverage" aria-label="Open class learning coverage">Coverage</a><style>{`.coverage-launch{position:fixed;right:18px;bottom:18px;z-index:80;background:#123f32;color:#fff;text-decoration:none;border:1px solid #ffffff33;border-radius:999px;padding:11px 15px;font:800 11px Manrope;box-shadow:0 8px 24px #0002}.coverage-launch:hover{background:#1d5645}.coverage-launch:focus-visible{outline:3px solid #d8ff6a;outline-offset:3px}@media(max-width:760px){.coverage-launch{right:14px;bottom:14px;padding:10px 13px}}`}</style></>;
}

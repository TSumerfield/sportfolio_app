import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./landing-polish.css";
import "./live/media.css";
import "./live/pro.css";
import OpenSportfolioMobileRouter from "./OpenSportfolioMobileRouter";

export const metadata: Metadata = {
  title: "Sportfolio",
  description: "Capture moments. Build progress.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><OpenSportfolioMobileRouter />{children}</body></html>;
}

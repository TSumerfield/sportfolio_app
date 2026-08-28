import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Sportfolio", description: "Capture progress. Reflect. Improve." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

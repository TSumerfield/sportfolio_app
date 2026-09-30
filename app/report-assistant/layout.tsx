import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free PE Report Comment Assistant | Sportfolio",
  description: "Turn PE observations, attainment and next steps into a concise report-comment draft. Free, no pupil name required.",
  alternates: { canonical: "https://www.mysportfolio.net/report-assistant" },
};

export default function ReportAssistantLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}

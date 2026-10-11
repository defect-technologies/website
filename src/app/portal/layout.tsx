import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Your portal", template: "%s · defect.tech" },
  robots: { index: false, follow: false },
};

export default function PortalRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh">{children}</div>;
}

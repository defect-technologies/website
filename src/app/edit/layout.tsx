import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Edit your site", template: "%s · defect.tech" },
  robots: { index: false, follow: false },
};

export default function EditorRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-svh">{children}</div>;
}

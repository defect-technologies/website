import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";

const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · admin · defect.tech" },
  robots: { index: false, follow: false },
  // Added to a phone's home screen, the admin opens on what waits for a founder, without the browser's bars.
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Defect", statusBarStyle: "default" },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className={`${mono.variable} min-h-svh`}>{children}</div>;
}

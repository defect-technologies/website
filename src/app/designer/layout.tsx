import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";

const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: { default: "Designer", template: "%s · designer · defect.tech" },
  robots: { index: false, follow: false },
};

export default function DesignerRoot({ children }: { children: React.ReactNode }) {
  return <div className={`${mono.variable} min-h-svh`}>{children}</div>;
}

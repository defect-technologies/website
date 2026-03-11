import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEFECT.TECH — Design Studio",
  description:
    "Deviation is the discipline. Typefaces, identities, and web experiences designed to defect from expectation.",
  openGraph: {
    title: "DEFECT.TECH",
    description: "Deviation is the discipline.",
    siteName: "DEFECT.TECH",
  },
  twitter: {
    card: "summary_large_image",
    title: "DEFECT.TECH — Design Studio",
    description: "Deviation is the discipline.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

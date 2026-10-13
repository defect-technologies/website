import type { Metadata } from "next";
import { Big_Shoulders, Dr_Sugiyama, Geist } from "next/font/google";
import "./globals.css";
import { DESCRIPTION, LEGAL_NAME, OPEN_GRAPH, SITE_NAME, SITE_URL } from "@/lib/seo";

const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-big-shoulders",
});

const script = Dr_Sugiyama({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dr-sugiyama",
});

const body = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "defect.tech: website design for small businesses, $79 a month", template: "%s · defect.tech" },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: LEGAL_NAME, url: SITE_URL }],
  creator: LEGAL_NAME,
  publisher: LEGAL_NAME,
  category: "Website design",
  openGraph: { ...OPEN_GRAPH, url: "/", description: DESCRIPTION },
  twitter: { card: "summary_large_image", description: DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  formatDetection: { telephone: false },
};

/** Lets CSS hide the plain text under each painting only when scripts can lay the painting down. */
const MARK_SCRIPTS_RUNNING = "document.documentElement.classList.add('js')";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MARK_SCRIPTS_RUNNING }} />
      </head>
      <body
        className={`${display.variable} ${script.variable} ${body.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

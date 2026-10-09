import type { Metadata } from "next";
import { Big_Shoulders, Dr_Sugiyama, Geist } from "next/font/google";
import "./globals.css";

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
  title: { default: "defect.tech", template: "%s · defect.tech" },
  description: "We rebuild small-business websites and keep them current for $59 a month.",
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

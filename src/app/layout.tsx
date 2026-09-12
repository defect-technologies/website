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
  title: "defect.tech",
  description: "A design studio.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${script.variable} ${body.variable} font-body antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

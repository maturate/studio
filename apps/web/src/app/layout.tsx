import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

// Brand display face is "Hardcover" (not on Google Fonts / no license on hand).
// Fraunces is the closest available stand-in for headline/display moments —
// swap this out if a real Hardcover font file becomes available.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "superOS Workflow Studio",
  description: "Internal workflow builder for superOS content generation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${robotoMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

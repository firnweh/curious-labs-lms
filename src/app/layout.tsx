import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { TransitionProvider } from "@/components/SubjectTransition";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Curious Labs — Hands-on Learning",
  description:
    "Learn coding, robotics, AI and 3D modelling by doing. Browser experiments, zero installs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="grid-bg" aria-hidden />
        <TransitionProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line/60 mt-20">
          <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-ink-faint flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono tracking-tech">
              CURIOUS<span className="text-neon-cyan">LABS</span> // LEARN BY DOING
            </span>
            <span>Browser experiments · zero installs · grades 1–10</span>
          </div>
        </footer>
        </TransitionProvider>
      </body>
    </html>
  );
}

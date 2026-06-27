import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Orbitron, Fredoka } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";
import { TransitionProvider } from "@/components/SubjectTransition";
import { SessionProvider } from "@/components/SessionProvider";
import { SyncProvider } from "@/components/SyncProvider";
import { LanguageProvider } from "@/lib/i18n";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

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

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const round = Fredoka({
  variable: "--font-round",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Curious Labs — Hands-on Learning",
  description:
    "Learn coding, robotics, AI and 3D modelling by doing. Browser experiments, zero installs.",
};

export const viewport: Viewport = {
  themeColor: "#060810",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${orbitron.variable} ${round.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="grid-bg" aria-hidden />
        <ServiceWorkerRegister />
        <LanguageProvider>
        <SessionProvider>
          <SyncProvider>
            <TransitionProvider>
              <AppChrome>{children}</AppChrome>
            </TransitionProvider>
          </SyncProvider>
        </SessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

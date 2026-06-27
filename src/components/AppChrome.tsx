"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LoginGate } from "@/components/LoginGate";

/**
 * App chrome around the page. On the Studio (/scratch) we go "bare": no top nav
 * and no footer, so the editor runs truly full-screen — the Studio renders its
 * own "← Back" control to leave.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const bare = usePathname() === "/scratch";
  return (
    <>
      {!bare && <SiteHeader />}
      <Suspense fallback={null}>
        <LoginGate />
      </Suspense>
      <main className={bare ? "flex-1" : "flex-1 pt-16"}>{children}</main>
      {!bare && <SiteFooter />}
    </>
  );
}

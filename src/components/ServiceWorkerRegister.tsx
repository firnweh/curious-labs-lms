"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker in production. In development it does
 * the opposite — unregisters any lingering SW so cached build assets never
 * shadow fresh code while you're working.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      const register = () =>
        navigator.serviceWorker
          .register("/sw.js", { scope: "/", updateViaCache: "none" })
          .catch(() => {
            /* registration failed — app still works online */
          });

      if (document.readyState === "complete") register();
      else {
        window.addEventListener("load", register, { once: true });
        return () => window.removeEventListener("load", register);
      }
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  }, []);

  return null;
}

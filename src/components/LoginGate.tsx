"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginModal } from "@/components/LoginModal";

/**
 * Mounts the student login popup app-wide and owns when it opens:
 *  - automatically when the URL carries `?login=1` (the student path from the
 *    curiouslabs.online chooser)
 *  - whenever any "Login" control fires the `cl:open-login` window event
 */
export function LoginGate() {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("login") === "1") setOpen(true);
  }, [params]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("cl:open-login", onOpen);
    return () => window.removeEventListener("cl:open-login", onOpen);
  }, []);

  return <LoginModal open={open} onClose={() => setOpen(false)} />;
}

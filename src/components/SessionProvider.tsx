"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Principal, StudentInfo } from "@/lib/cloud-types";
import { getPrincipal, signOutAll } from "@/app/actions/accounts";

interface SessionCtx {
  principal: Principal | null;
  /** Convenience: the learner, iff a student is signed in (used by the sync bridge). */
  student: StudentInfo | null;
  loading: boolean;
  /** Re-read the session (call after a successful join / login). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  principal: null,
  student: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setPrincipal(await getPrincipal());
    } catch {
      setPrincipal(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await signOutAll();
    } finally {
      setPrincipal(null);
    }
  }, []);

  const student = principal?.kind === "student" ? principal.student : null;

  return <Ctx.Provider value={{ principal, student, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx);
}

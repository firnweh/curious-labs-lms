/**
 * Right-side header action. Auth lives on the existing Curious Labs app
 * (NextAuth, https://curiouslabs.online) — this carousel/LMS front-end has no
 * backend of its own, so the Login button simply sends users to that login.
 */

/** Existing Curious Labs login (NextAuth). Change here if the domain moves. */
export const LOGIN_URL = "https://curiouslabs.online/login";

export function HeaderAuth() {
  return (
    <a
      href={LOGIN_URL}
      className="rounded-full border border-neon-cyan/50 bg-neon-cyan/10 px-5 py-2 font-mono text-sm font-semibold tracking-tech text-neon-cyan transition-colors hover:border-neon-cyan hover:bg-neon-cyan/20"
    >
      Login
    </a>
  );
}

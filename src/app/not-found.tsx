import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md place-items-center px-5 py-28 text-center">
      <p className="font-mono text-sm tracking-tech text-neon-cyan neon-text">
        ERR // 404
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink">
        This lab doesn&apos;t exist
      </h1>
      <p className="mt-2 text-ink-dim">
        The experiment you&apos;re looking for isn&apos;t here. Let&apos;s get you
        back to the makerspace.
      </p>
      <Link
        href="/"
        className="mt-7 rounded-xl bg-neon-cyan px-6 py-3 font-semibold text-[#05070d] transition-transform hover:scale-[1.03] neon-ring"
      >
        ← Back to home
      </Link>
    </div>
  );
}

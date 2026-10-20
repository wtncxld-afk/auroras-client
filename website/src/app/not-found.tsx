import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark size={44} />
      <p className="mt-8 text-2xs font-semibold uppercase tracking-[0.16em] text-aurora-cyan">404</p>
      <h1 className="mt-3 text-3xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-3 max-w-md text-ink-mute">It may have moved, or the release it pointed to is no longer public.</p>
      <div className="mt-8 flex gap-3"><Link href="/" className={buttonClass("primary")}>Home</Link><Link href="/download" className={buttonClass("secondary")}>Downloads</Link></div>
    </main>
  );
}

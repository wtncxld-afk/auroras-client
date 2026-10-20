import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth/guard";
import { LoginForm } from "./LoginForm";
import { AuroraBackdrop } from "@/components/site/AuroraBackdrop";
import { LogoMark } from "@/components/ui/Logo";

export const metadata: Metadata = { title: "Owner sign-in", robots: { index: false, follow: false } };
export default async function LoginPage() {
  if (await currentOwner()) redirect("/owner");
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-16">
      <AuroraBackdrop intensity={0.55} />
      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center"><LogoMark size={40} /><h1 className="mt-5 text-xl font-semibold">Owner sign-in</h1><p className="mt-1.5 text-sm text-ink-mute">Restricted area. Every attempt is recorded.</p></div>
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-night-850/85 p-6 shadow-lift backdrop-blur-xl"><LoginForm /></div>
        <p className="mt-6 text-center text-xs leading-5 text-ink-faint">Lost your password or authenticator? Recover from the server: <code className="text-ink-mute">npm run owner:reset-password</code> / <code className="text-ink-mute">owner:reset-mfa</code>.</p>
      </div>
    </main>
  );
}

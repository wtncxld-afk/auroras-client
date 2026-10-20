import type { Metadata } from "next";
import { requireOwnerPage } from "@/lib/auth/guard";
import { OwnerShell } from "@/components/owner/Shell";

export const metadata: Metadata = { title: { default: "Owner", template: "%s · Owner · Auroras" }, robots: { index: false, follow: false } };

// The shell needs the session for the CSRF token; every page below also calls requireOwnerPage() itself, because
// layouts are not re-run on client-side navigation.
export default async function SecureLayout({ children }: { children: React.ReactNode }) {
  const s = await requireOwnerPage();
  return (<><meta name="csrf-token" content={s.csrfToken} /><OwnerShell username={s.username}>{children}</OwnerShell></>);
}

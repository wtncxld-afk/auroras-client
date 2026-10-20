import { CheckCircle2, CircleAlert } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { ciTokens, ownerInfo, sessionsFor } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { Panel } from "@/components/owner/ui";
import { CiTokensPanel, SessionsPanel } from "@/components/owner/SecurityPanels";
import { formatDateTime } from "@/components/ui/format";

export const metadata = { title: "Security" };
export default async function SecurityPage() {
  const session = await requireOwnerPage();
  const [info, sessions, tokens] = await Promise.all([ownerInfo(session.ownerId), sessionsFor(session.ownerId), ciTokens()]);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return (
    <>
      <PageHeader title="Security" description="Your account, sessions and automation access." />
      <div className="space-y-6">
        <Panel title="Owner account">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-ink-faint">Username</dt><dd className="mt-1 font-medium">{info.username}</dd></div>
            <div><dt className="text-xs text-ink-faint">Last sign-in</dt><dd className="mt-1">{formatDateTime(info.lastLoginAt)}</dd></div>
            <div><dt className="text-xs text-ink-faint">Two-step verification</dt><dd className="mt-1 flex items-center gap-2">{info.totpEnabled ? <><CheckCircle2 size={16} className="text-ok" />Authenticator app (TOTP) on</> : <><CircleAlert size={16} className="text-warn" />Off. Required in production; set it up with the owner CLI.</>}</dd></div>
            <div><dt className="text-xs text-ink-faint">Unused recovery codes</dt><dd className={"mt-1 " + (info.recoveryCodesLeft < 3 ? "text-warn" : "")}>{info.recoveryCodesLeft}</dd></div>
            <div><dt className="text-xs text-ink-faint">Password last changed</dt><dd className="mt-1">{formatDateTime(info.passwordChangedAt)}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl border border-line bg-night-900/60 p-4 text-xs leading-6 text-ink-mute">
            Password changes, MFA resets and new recovery codes are done from the server with the owner CLI, so a stolen browser session can&apos;t lock you out or take over the account:
            <pre className="mt-2 overflow-x-auto font-mono text-[12px] text-ink-soft">npm run owner:reset-password{"\n"}npm run owner:reset-mfa{"\n"}npm run owner:revoke-sessions</pre>
            Changing the password signs out every session.
          </div>
        </Panel>
        <SessionsPanel sessions={sessions.map((s) => ({ id: s.id.slice(0, 16), createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), expiresAt: s.expiresAt.toISOString(), userAgent: s.userAgent, current: s.id === session.id }))} />
        <CiTokensPanel tokens={tokens.map((t) => ({ id: t.id, name: t.name, scopes: t.scopes, createdAt: t.createdAt.toISOString(), lastUsedAt: iso(t.lastUsedAt), revokedAt: iso(t.revokedAt) }))} />
      </div>
    </>
  );
}

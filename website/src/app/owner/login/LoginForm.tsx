"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, inputCls, Spinner } from "@/components/owner/ui";

export function LoginForm() {
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/owner/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ username: f.get("username"), password: f.get("password"), code: f.get("code") }) });
      if (r.ok) { window.location.href = "/owner"; return; }
      const d = await r.json().catch(() => ({})); setErr(d?.error?.message ?? "Sign-in failed.");
    } catch { setErr("Couldn't reach the server."); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Username" htmlFor="username"><input id="username" name="username" autoComplete="username" required className={inputCls} /></Field>
      <Field label="Password" htmlFor="password"><input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} /></Field>
      <Field label="Authenticator code" htmlFor="code" hint="6-digit code from your authenticator app, or a recovery code."><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" className={inputCls + " font-mono tracking-[0.2em]"} /></Field>
      {err && <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-[#ffd0d0]">{err}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy && <Spinner />}Sign in</Button>
    </form>
  );
}

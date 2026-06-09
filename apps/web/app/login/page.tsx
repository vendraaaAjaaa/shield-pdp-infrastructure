"use client";

import { ArrowRight, Fingerprint, KeyRound, Landmark, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoJourney } from "@/components/demo-context";
import { RoleSwitcher, useDemoRole } from "@/components/role-switcher";
import { Button, Card, Input } from "@/components/ui/primitives";
import { demoRoles, getRoleProfile } from "@/lib/auth-demo";
import { isBackendConfigured, loginWithBackend } from "@/lib/api/client";
import type { Role } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { profile, setRole } = useDemoRole();
  const [mfaArmed, setMfaArmed] = useState(false);
  const [username, setUsername] = useState("budi");
  const [password, setPassword] = useState("password123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const backendConfigured = isBackendConfigured();

  return (
    <main className="security-weave min-h-screen px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="inline-flex items-center gap-3 rounded-lg border border-white/15 bg-white/[0.08] px-4 py-3 shadow-panel backdrop-blur">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-teal-200/30 bg-teal-200/10 text-teal-100">
              <Landmark aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">Dana Sejahtera Shield</p>
              <p className="text-xs text-slate-300">Shield-PDP Fintech Portal</p>
            </div>
          </div>
          <h1 className="mt-8 max-w-3xl font-display text-4xl font-semibold tracking-normal md:text-6xl">
            Secure fintech operations with privacy evidence in the same workflow.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            A controlled demo portal for customer banking flows, admin operations, UU PDP compliance, and safe penetration-test validation.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["Masked data", "NIK and account details are hidden by default."],
              ["Role scoped", "Demo roles expose different evidence views."],
              ["Synthetic only", "No real secrets, payloads, or customer data."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-lg border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur">
                <ShieldCheck aria-hidden className="h-5 w-5 text-teal-200" />
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <DemoJourney />
          </div>
        </section>

        <Card className="border-white/[0.12] bg-white/[0.94] p-6 text-foreground shadow-panel dark:bg-card">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Demo access</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Sign in to Shield</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Select a role to explore customer, operations, compliance, or pentest views.</p>
          </div>
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              if (!backendConfigured) {
                router.push(profile.homePath);
                return;
              }
              setIsSubmitting(true);
              try {
                const session = await loginWithBackend(username, password);
                setRole(session.user.role as Role);
                router.push(getRoleProfile(session.user.role as Role).homePath);
              } catch (caught) {
                const message = caught instanceof Error ? caught.message : "Backend login failed";
                setError(message);
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <label className="grid gap-2 text-sm font-semibold">
              Username
              <Input value={backendConfigured ? username : profile.userName} readOnly={!backendConfigured} onChange={(event) => setUsername(event.target.value)} aria-label="Username" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Password
              <Input value={backendConfigured ? password : "Not required in mock mode"} readOnly={!backendConfigured} type={backendConfigured ? "password" : "text"} onChange={(event) => setPassword(event.target.value)} aria-label="Password" />
            </label>
            <RoleSwitcher />
            <div className="rounded-lg border border-border bg-muted/45 p-4">
              <div className="flex items-start gap-3">
                <KeyRound aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">MFA placeholder</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">This demo simulates MFA readiness without exposing real secrets or sending codes.</p>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                    onClick={() => setMfaArmed((value) => !value)}
                  >
                    <Fingerprint aria-hidden className="h-4 w-4" />
                    {mfaArmed ? "MFA challenge armed" : "Arm MFA challenge"}
                  </button>
                </div>
              </div>
            </div>
            {error ? (
              <div className="rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                {error}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {backendConfigured ? (isSubmitting ? "Signing in" : "Sign in with backend") : `Continue as ${profile.label}`}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          </form>
          <div className="mt-6 rounded-lg border border-warning/35 bg-warning/10 p-4">
            <p className="text-sm font-semibold text-warning">Security notice</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Use only synthetic lab data. Do not enter real credentials, NIK, bank account numbers, or secrets.
            </p>
          </div>
          <div className="mt-5 grid gap-2 text-xs text-muted-foreground">
            {demoRoles.map((role) => (
              <p key={role.id}>
                <span className="font-semibold text-foreground">{role.label}:</span> {role.description}
              </p>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}

import { FileClock, Fingerprint, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react";
import { DataClassificationBadge, StatusPill } from "@/components/badges";
import { DemoCallout } from "@/components/demo-context";
import { ErrorState } from "@/components/empty-loading";
import { MaskedValue } from "@/components/masked-value";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getPrivacyProfile } from "@/lib/api/client";
import { errorMessage, ensureArray } from "@/lib/normalize";
import { formatDateTime } from "@/lib/formatters";
import type { PrivacyProfile } from "@/lib/types";

const emptyPrivacyProfile: PrivacyProfile = {
  customerId: "Unknown",
  displayName: "Unknown",
  maskedNik: "Unknown",
  maskedPhone: "Unknown",
  emailAlias: "Unknown",
  biometricStatus: "Not enrolled",
  retentionStatus: "Privacy profile data is unavailable from the configured backend.",
  deletionRequestStatus: "Unknown",
  dataCategories: [],
  consents: [],
};

export default async function PrivacyProfilePage() {
  const profileResult = await getPrivacyProfile()
    .then((profile) => ({ status: "fulfilled" as const, value: profile }))
    .catch((reason: unknown) => ({ status: "rejected" as const, reason }));
  const profile = profileResult.status === "fulfilled" ? profileResult.value : emptyPrivacyProfile;
  const dataCategories = ensureArray<PrivacyProfile["dataCategories"][number]>(profile.dataCategories);
  const consents = ensureArray<PrivacyProfile["consents"][number]>(profile.consents);

  return (
    <RoleGuard allowed={["customer", "auditor"]}>
      <PageHeader
        eyebrow="Privacy profile"
        title="Personal data, consent, and retention"
        description="A customer-facing privacy workspace for NIK masking, biometric metadata status, consent history, and deletion-request simulation."
      />
      {profileResult.status === "rejected" ? (
        <div className="mb-6">
          <ErrorState description={`Backend live privacy profile is unavailable: ${errorMessage(profileResult.reason)}`} />
        </div>
      ) : null}
      <DemoCallout
        title="Sensitive data is masked, classified, and audited"
        description="This view demonstrates PDP-friendly fintech UX: customers can see what data exists, sensitive values stay masked by default, reveal actions are challenged, and the audit preview explains what would be recorded."
        icon={LockKeyhole}
      >
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
          <p className="rounded-md border border-border bg-card px-3 py-2">NIK and phone use reveal warnings and audit preview.</p>
          <p className="rounded-md border border-border bg-card px-3 py-2">Biometric metadata is represented as a token, not raw biometric data.</p>
          <p className="rounded-md border border-border bg-card px-3 py-2">Data categories carry classification, retention, and access policy labels.</p>
        </div>
      </DemoCallout>
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Consent records" value={`${consents.length}`} icon={ShieldCheck} tone="success" />
        <MetricCard label="Biometric status" value="Enrolled" icon={Fingerprint} tone="info" />
        <MetricCard label="Retention state" value="Active" icon={FileClock} tone="warning" description="Retention follows active-account and audit requirements." />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="Identity summary" description="Sensitive values use reveal confirmation with audit preview." />
          <div className="grid gap-5 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Customer ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">{profile.customerId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Display name</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{profile.displayName}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">NIK</p>
              <MaskedValue label="NIK" masked={profile.maskedNik} revealed="3174 0000 0000 8842" reason="Customer privacy self-service request" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Phone</p>
              <MaskedValue label="Phone number" masked={profile.maskedPhone} revealed="+62 800 0000 4470" reason="Customer contact verification" />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Biometric metadata</p>
              <MaskedValue label="Biometric template token" masked="bio_tmpl_****_8842" revealed="bio_tmpl_demo_only_8842" reason="Biometric enrollment audit review" />
            </div>
            <div className="flex flex-wrap gap-2">
              <DataClassificationBadge classification="Sensitive Personal Data" />
              <StatusPill status={profile.biometricStatus} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Personal data categories" description="Data category, location, retention, and access policy evidence." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Classification</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Retention</th>
                  <th className="px-4 py-3 font-semibold">Access policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dataCategories.length ? dataCategories.map((category) => (
                  <tr key={category.name} className="bg-card">
                    <td className="px-4 py-4 font-semibold text-foreground">{category.name}</td>
                    <td className="px-4 py-4"><DataClassificationBadge classification={category.classification} /></td>
                    <td className="px-4 py-4 text-muted-foreground">{category.location}</td>
                    <td className="px-4 py-4 text-muted-foreground">{category.retention}</td>
                    <td className="px-4 py-4 text-muted-foreground">{category.accessPolicy}</td>
                  </tr>
                )) : (
                  <tr className="bg-card">
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No personal data categories are available from the configured backend.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Consent records" description="Purpose and retention state for each synthetic consent record." />
          <div className="divide-y divide-border">
            {consents.length ? consents.map((consent) => (
              <div key={consent.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{consent.purpose}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{consent.id} - {formatDateTime(consent.grantedAt)}</p>
                  </div>
                  <StatusPill status={consent.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{consent.retention}</p>
              </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No consent records are available from the configured backend.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-danger/30 bg-danger/10 text-danger">
              <Trash2 aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">Right to deletion placeholder</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{profile.deletionRequestStatus}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Demo requests would be routed to legal retention review before any deletion workflow changes account or audit data.
              </p>
              <Button type="button" variant="secondary" className="mt-4" disabled>
                Request deletion review
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </RoleGuard>
  );
}

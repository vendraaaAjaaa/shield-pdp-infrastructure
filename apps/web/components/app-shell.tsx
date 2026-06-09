"use client";

import {
  Activity,
  BarChart3,
  Bell,
  BookMarked,
  Building2,
  ClipboardCheck,
  FileClock,
  FileText,
  Fingerprint,
  Gauge,
  Home,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Menu,
  Network,
  ReceiptText,
  SearchCheck,
  Send,
  ShieldCheck,
  ShieldQuestion,
  Siren,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { RoleSwitcher, useDemoRole } from "@/components/role-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/primitives";
import type { BackendConnectionState } from "@/lib/api/client";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
};

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Customer Portal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["customer", "admin"] },
      { href: "/accounts", label: "Accounts", icon: WalletCards, roles: ["customer", "admin"] },
      { href: "/transactions", label: "Transactions", icon: ReceiptText, roles: ["customer", "admin"] },
      { href: "/transfer", label: "Transfer", icon: Send, roles: ["customer"] },
      { href: "/profile/privacy", label: "Privacy Profile", icon: Fingerprint, roles: ["customer", "auditor"] },
      { href: "/security", label: "Security", icon: ShieldCheck, roles: ["customer", "admin"] },
    ],
  },
  {
    title: "Compliance",
    items: [
      { href: "/compliance", label: "PDP Controls", icon: ClipboardCheck, roles: ["auditor", "admin"] },
      { href: "/compliance/gap-analysis", label: "Gap Analysis", icon: ListChecks, roles: ["auditor", "pentester", "admin"] },
      { href: "/compliance/breach-notification", label: "Breach Timeline", icon: FileClock, roles: ["auditor", "admin"] },
    ],
  },
  {
    title: "Security Testing",
    items: [
      { href: "/pentest", label: "Pentest Overview", icon: ShieldQuestion, roles: ["pentester", "auditor", "admin"] },
      { href: "/pentest/findings", label: "Findings", icon: SearchCheck, roles: ["pentester", "auditor", "admin"] },
      { href: "/pentest/bola", label: "API BOLA Evidence", icon: LockKeyhole, roles: ["pentester", "auditor", "admin"] },
      { href: "/pentest/segmentation", label: "Segmentation", icon: Network, roles: ["pentester", "admin"] },
    ],
  },
  {
    title: "Enterprise",
    items: [
      { href: "/executive", label: "Executive Risk", icon: BarChart3, roles: ["admin", "auditor"] },
      { href: "/reports", label: "Reports", icon: FileText, roles: ["admin", "auditor", "pentester"] },
      { href: "/admin", label: "Operations", icon: Building2, roles: ["admin"] },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: BookMarked, roles: ["admin", "auditor"] },
      { href: "/admin/incidents", label: "Incidents", icon: Siren, roles: ["admin", "auditor"] },
    ],
  },
];

export function AppShell({ children, backendState }: { children: ReactNode; backendState?: BackendConnectionState }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-72">
        <Topbar onMenu={() => setOpen(true)} backendState={backendState ?? "mock"} />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { role } = useDemoRole();

  const content = (
    <div className="flex min-h-full flex-col bg-[#071b22] text-slate-100">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
        <div className="grid h-11 w-11 place-items-center rounded-md border border-teal-300/25 bg-teal-300/10 text-teal-200">
          <Landmark aria-hidden className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold tracking-normal">Dana Sejahtera Shield</p>
          <p className="truncate text-xs text-slate-400">Shield-PDP Fintech Portal</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.title}</p>
            <div className="grid gap-1">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                const restricted = item.roles ? !item.roles.includes(role) : false;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                      active ? "bg-teal-300/[0.14] text-white ring-1 ring-teal-200/20" : "text-slate-300 hover:bg-white/10 hover:text-white",
                      restricted && "opacity-55",
                    )}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {restricted ? <LockKeyhole aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-300" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg border border-teal-200/15 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Activity aria-hidden className="h-4 w-4 text-teal-200" />
            Lab safety mode
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Synthetic data, role-scoped UI, and safe validation evidence only.</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">{content}</aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/45 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[86vw] shadow-panel">{content}</aside>
          <button className="absolute right-4 top-4 rounded-md bg-card p-2 text-foreground shadow-soft" onClick={onClose} aria-label="Close navigation">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </>
  );
}

export function Topbar({ onMenu, backendState }: { onMenu: () => void; backendState: BackendConnectionState }) {
  const { profile } = useDemoRole();
  const backendTone =
    backendState === "connected"
      ? "border-info/30 bg-info/10 text-info"
      : backendState === "error"
        ? "border-warning/35 bg-warning/10 text-warning"
        : "border-border bg-muted text-muted-foreground";
  const backendLabel = backendState === "connected" ? "Backend live" : backendState === "error" ? "Backend error" : "Mock adapter";

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/[0.86] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button type="button" variant="secondary" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu aria-hidden className="h-5 w-5" />
        </Button>
        <Link href="/dashboard" className="hidden items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:flex">
          <Home aria-hidden className="h-4 w-4" />
          Portal
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <div className={cn("hidden items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold md:flex", backendTone)}>
            <Activity aria-hidden className="h-4 w-4" />
            {backendLabel}
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success md:flex">
            <ShieldCheck aria-hidden className="h-4 w-4" />
            MFA ready
          </div>
          <button className="relative rounded-md border border-border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Notifications">
            <Bell aria-hidden className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-background" />
          </button>
          <ThemeToggle />
          <div className="hidden md:block">
            <RoleSwitcher compact />
          </div>
          <div className="hidden min-w-0 items-center gap-3 rounded-md border border-border bg-card px-3 py-2 lg:flex">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
              <UserRound aria-hidden className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{profile.userName}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.title}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border px-4 py-3 md:hidden">
        <RoleSwitcher />
      </div>
    </header>
  );
}

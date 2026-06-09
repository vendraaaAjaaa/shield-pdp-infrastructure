import type { Role, RoleProfile } from "@/lib/types";

export const demoRoles: RoleProfile[] = [
  {
    id: "customer",
    label: "Customer",
    userName: "Budi Santoso",
    title: "Verified Dana Sejahtera customer",
    clearance: "Personal account",
    homePath: "/dashboard",
    description: "Wallet, transactions, privacy consent, and security settings.",
  },
  {
    id: "admin",
    label: "Admin",
    userName: "Admin Dana Sejahtera",
    title: "Operations lead",
    clearance: "Internal operations",
    homePath: "/admin",
    description: "Customer monitoring, incident queue, and audit log access.",
  },
  {
    id: "auditor",
    label: "Auditor",
    userName: "Auditor",
    title: "UU PDP compliance officer",
    clearance: "Compliance evidence",
    homePath: "/compliance",
    description: "Control evidence, breach timeline, and gap analysis.",
  },
  {
    id: "pentester",
    label: "Pentester",
    userName: "Pentester",
    title: "Authorized security tester",
    clearance: "Approved lab scope",
    homePath: "/pentest",
    description: "Rules of engagement, safe findings, and validation evidence.",
  },
];

export const roleStorageKey = "shield-pdp-demo-role";

export function getRoleProfile(role: Role) {
  return demoRoles.find((item) => item.id === role) ?? demoRoles[0];
}

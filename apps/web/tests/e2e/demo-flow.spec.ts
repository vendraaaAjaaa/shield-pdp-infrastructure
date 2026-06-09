import { expect, type Page, test } from "@playwright/test";

const roleStorageKey = "shield-pdp-demo-role";

async function setDemoRole(page: Page, role: "customer" | "admin" | "auditor" | "pentester") {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [roleStorageKey, role] as const,
  );
}

async function expectNoFatalRuntimeError(page: Page) {
  await expect(page.getByText(/displayedData\.map is not a function/i)).toHaveCount(0);
  await expect(page.getByText(/Unhandled Runtime Error/i)).toHaveCount(0);
  await expect(page.getByText(/TypeError:/i)).toHaveCount(0);
}

test("login page loads and role switching works", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /secure fintech operations/i })).toBeVisible();
  await expect(page.getByTestId("role-switcher")).toBeVisible();

  await page.getByTestId("role-switcher").selectOption("admin");
  await expect(page.getByRole("button", { name: /continue as admin/i })).toBeVisible();
  await expectNoFatalRuntimeError(page);
});

test("budi customer login opens dashboard in mock mode", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("role-switcher").selectOption("customer");
  await page.getByRole("button", { name: /continue as customer/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /wallet, privacy, and account security/i })).toBeVisible();
  await expectNoFatalRuntimeError(page);
});

test("customer dashboard loads", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /wallet, privacy, and account security/i })).toBeVisible();
  await expect(page.getByText(/customer trust journey/i)).toBeVisible();
  await expectNoFatalRuntimeError(page);
});

test("customer money movement pages load", async ({ page }) => {
  await setDemoRole(page, "customer");

  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: /accounts and data exposure/i })).toBeVisible();
  await expectNoFatalRuntimeError(page);

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: /transactions and idor simulation/i })).toBeVisible();
  await expectNoFatalRuntimeError(page);

  await page.goto("/transfer");
  await expect(page.getByRole("heading", { name: /money movement controls/i })).toBeVisible();
  await expectNoFatalRuntimeError(page);
});

test("compliance page loads for auditor", async ({ page }) => {
  await setDemoRole(page, "auditor");
  await page.goto("/compliance");
  await expect(page.getByRole("heading", { name: /evidence readiness and privacy controls/i })).toBeVisible();
  await expect(page.getByText("PDP-01")).toBeVisible();
  await expect(page.getByText("PDP-02")).toBeVisible();
  await expect(page.getByText("PDP-03")).toBeVisible();
  await expectNoFatalRuntimeError(page);
});

test("pentest findings page loads for pentester", async ({ page }) => {
  await setDemoRole(page, "pentester");
  await page.goto("/pentest/findings");
  await expect(page.getByRole("heading", { name: /cvss findings and pdp impact/i })).toBeVisible();
  await expect(page.getByText("FIND-001")).toBeVisible();
  await expectNoFatalRuntimeError(page);
});

test("admin audit logs page loads for admin", async ({ page }) => {
  await setDemoRole(page, "admin");
  await page.goto("/admin/audit-logs");
  await expect(page.getByRole("heading", { name: /sensitive access and policy decisions/i })).toBeVisible();
  await expect(page.getByText("AUD-4101")).toBeVisible();
  await expectNoFatalRuntimeError(page);
});

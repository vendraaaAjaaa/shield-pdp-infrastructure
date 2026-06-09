# NO-MISTAKE-ALL Debug Plan

Date: 2026-06-05

## Inspection Summary

- Inspected the dashboard page, chart components, API client, mock data, safe ID helper, Next.js config, portal pages, and shared components under `apps/web/components`.
- Inspected all Recharts usage in `apps/web/components/charts.tsx`.
- Inspected all portal routes listed in the request, including customer, admin, auditor, pentest, executive, compliance, and report pages.
- Inspected backend route response shapes in `api/vulnerable/main.py` for `/me/accounts`, `/me/transactions`, `/accounts/{id}`, `/transactions/{id}`, `/transfers`, `/audit/events`, `/pentest/findings`, `/segmentation/internal-db/status`, and `/dashboard/summary`.
- Searched browser-facing code for direct `crypto.randomUUID`, `window.crypto`, and `globalThis.crypto` usage.

## Root Cause Hypothesis

The dashboard crash was caused by non-array chart data reaching Recharts. Recharts internally calls `.map` on its displayed data, so any backend object shape sent directly or indirectly to chart `data` can crash the page. The live backend mostly returns object envelopes like `{ items: [...] }`, while some frontend paths still assume `body.items` only and some shared components assume typed arrays at their boundary.

## Implementation Plan

1. Add `apps/web/lib/normalize.ts` with reusable safe helpers for arrays, objects, numbers, strings, booleans, dates, API item envelopes, and error message extraction.
2. Update chart helpers so every chart receives arrays only, including `{ items: [...] }`, `{ data: [...] }`, and nested chart-series shapes.
3. Add TypeScript-level regression guards for normalization and chart/dashboard normalization before production code changes.
4. Harden dashboard data derivation, metric defaults, chart empty states, and backend error reporting without mock fallback when backend is configured.
5. Harden client-side live pages that call vulnerable endpoints for BurpSuite visibility: accounts, transactions, transfers, pentest findings, segmentation, and audit logs.
6. Harden server-rendered pages by using settled fetches, normalized arrays, and visible error cards instead of render crashes.
7. Harden shared table/card/chart components against non-array props and invalid formatter inputs.
8. Preserve vulnerable and secure pentest behavior, PostgreSQL/Tailscale/firewall settings, and BurpSuite-visible request URLs.
9. Add Next.js `allowedDevOrigins` entries for LAN and local development while preserving existing config.
10. Verify safe client ID usage remains limited to request/correlation/UI IDs.
11. Run typecheck, lint, build, LAN build, `make web-build-lan`, smoke test, redteam simulation, and dev server startup. Record failures and unresolved limitations in the report.

## Non-Goals

- No database schema, PostgreSQL listener, Tailscale, firewall, pg_hba, vulnerable endpoint, or secure endpoint changes.
- No major redesign and no removal of charts, pages, or BurpSuite demo flows.

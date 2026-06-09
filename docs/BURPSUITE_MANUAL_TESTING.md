# BurpSuite Manual Testing

## Safety Scope

Use these steps only against the local Shield-PDP lab. Do not target external systems, do not use real personal data, and do not attempt destructive payloads. The vulnerable endpoints are intentionally exposed for controlled comparison with secure endpoints.

## Browser And Proxy Setup

1. Start the backend gateway: `make up`.
2. Start the frontend: `cd apps/web && NEXT_PUBLIC_SHIELD_API_BASE_URL=http://localhost:3000 npm run dev`.
3. Configure the browser to use BurpSuite as its HTTP proxy, usually `127.0.0.1:8080`.
4. Browse to `http://localhost:3200/login`.
5. Log in as Budi with `username=budi` and `password=password123`.

The browser should generate form-url-encoded login traffic:

```http
POST /api/v1/vulnerable/login
Content-Type: application/x-www-form-urlencoded

username=budi&password=password123
```

Authenticated requests include `Authorization: Bearer <access_token>`. Do not share or paste token values into reports.

## Direct Kali LAN Access

Use this mode when Kali should browse the app directly instead of using SSH tunnels or a localhost browser.

1. SSH to shield-cloud only for server administration:

```bash
ssh ubuntu@192.168.18.205
```

2. On shield-cloud, confirm backend/proxy health:

```bash
docker compose ps api-vulnerable proxy
curl http://localhost:3000/api/v1/vulnerable/ready
```

3. Run the frontend with the LAN API base:

```bash
make web-dev-lan
```

Equivalent manual command:

```bash
cd apps/web
NEXT_PUBLIC_SHIELD_API_BASE_URL=http://192.168.18.205:3000 npm run dev
```

4. From the Kali browser, open:

```text
http://192.168.18.205:3200/login
```

5. Configure the Kali browser to use BurpSuite at `127.0.0.1:8080`.

Expected requests:

```http
POST http://192.168.18.205:3000/api/v1/vulnerable/login
GET http://192.168.18.205:3000/api/v1/vulnerable/accounts/ACC-BUDI-001
GET http://192.168.18.205:3000/api/v1/vulnerable/transactions/TRX-BUDI-001
POST http://192.168.18.205:3000/api/v1/vulnerable/transfers
```

Manual modifications:

- `ACC-BUDI-001` -> `ACC-MAYA-001`
- `TRX-BUDI-001` -> `TRX-MAYA-001`
- `sourceAccountId` -> `ACC-MAYA-001`

## Account IDOR

Normal request from `/accounts`:

```http
GET /api/v1/vulnerable/accounts/ACC-BUDI-001
```

Burp modification:

```http
GET /api/v1/vulnerable/accounts/ACC-MAYA-001
```

Expected result: HTTP 200 with masked Maya account metadata, `metadata.crossOwner=true`, an `auditEventId`, and an `evidenceId`.

Secure comparison:

```http
GET /api/v1/secure/accounts/ACC-MAYA-001
```

Expected result: HTTP 403 with blocked audit/evidence metadata.

## Transaction IDOR

Normal request from `/transactions`:

```http
GET /api/v1/vulnerable/transactions/TRX-BUDI-001
```

Burp modification:

```http
GET /api/v1/vulnerable/transactions/TRX-MAYA-001
```

Expected result: HTTP 200 with Maya transaction detail, cross-owner metadata, an audit event, and evidence.

Secure comparison:

```http
GET /api/v1/secure/transactions/TRX-MAYA-001
```

Expected result: HTTP 403.

## Transfer Source Account Tampering

Normal request from `/transfer`:

```http
POST /api/v1/vulnerable/transfers
Content-Type: application/json

{
  "sourceAccountId": "ACC-BUDI-001",
  "destinationAccountId": "ACC-NADIA-001",
  "amount": 125000,
  "note": "synthetic transfer"
}
```

Burp modification:

```json
{
  "sourceAccountId": "ACC-MAYA-001",
  "destinationAccountId": "ACC-NADIA-001",
  "amount": 125000,
  "note": "sourceAccountId tampered in Burp"
}
```

Expected vulnerable result: HTTP 201 with `transferId`, `sourceTransactionId`, `destinationTransactionId`, `evidenceId`, `auditEventId`, `authenticatedUser=budi`, `sourceAccountOwner=CUST-MAYA`, `idorDetected=true`, and `risk=high`.

Secure comparison:

```http
POST /api/v1/secure/transfers
```

Expected result with Maya source account: HTTP 403. The secure route writes blocked audit/evidence metadata but does not change balances and does not insert debit or credit transaction rows.

## Transfer Ledger Behavior

Accepted vulnerable or secure transfers post a controlled synthetic ledger entry in PostgreSQL:

- Budi to Nadia decreases `ACC-BUDI-001` and increases `ACC-NADIA-001`.
- Budi sees the debit transaction in `/transactions`.
- Nadia sees the credit transaction when logged in as `nadia / password123`.
- The response includes transfer ID, debit transaction ID, credit transaction ID, source/destination balance before/after, audit ID, and evidence ID when applicable.
- Vulnerable mode still trusts `sourceAccountId`, so changing it to `ACC-MAYA-001` posts a debit from Maya's synthetic wallet and creates critical transfer IDOR evidence.
- Secure mode validates source ownership first; changing `sourceAccountId` to `ACC-MAYA-001` returns HTTP 403 and does not post the ledger.

No real money moves. All balances and transactions are synthetic Shield-PDP lab data.

## Broken Access Control

Budi customer token:

```http
GET /api/v1/vulnerable/admin/users
```

Expected result: HTTP 403 and an audit event for denied admin access. Admin token should return HTTP 200.

## Segmentation Evidence

```http
GET /api/v1/vulnerable/segmentation/internal-db/status
```

Expected result: HTTP 200 with `segmentationStatus=enforced`, `databaseHost=100.110.198.103`, `allowedClient=100.119.241.7`, `transport=Tailscale`, and `publicListen=false`.

## Evidence Views

- Open `/pentest/findings` as admin, auditor, or pentester to view generated evidence.
- Open `/admin/audit-logs` as admin to view audit events.
- Run `make redteam-sim` for an automated version of the same flow.

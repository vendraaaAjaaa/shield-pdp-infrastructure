import json
import os
import sys
import uuid
from datetime import datetime, timezone
from urllib import error, parse, request


GATEWAY_URL = os.getenv("SHIELD_PDP_GATEWAY_URL", "http://localhost:3000").rstrip("/")
BASE_URL = os.getenv("SHIELD_PDP_API_URL", f"{GATEWAY_URL}/api/v1/vulnerable").rstrip("/")
SECURE_URL = os.getenv("SHIELD_PDP_SECURE_API_URL", f"{GATEWAY_URL}/api/v1/secure").rstrip("/")
TIMEOUT = float(os.getenv("SHIELD_PDP_HTTP_TIMEOUT", "5"))


def call(method, path, token=None, data=None, json_body=None, expected=None, base_url=BASE_URL):
    headers = {"X-Request-ID": f"smoke-{uuid.uuid4()}"}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        body = parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if json_body is not None:
        body = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = request.Request(f"{base_url}{path}", data=body, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else None
            status = resp.status
            response_headers = dict(resp.headers)
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        parsed = json.loads(raw) if raw else raw
        status = exc.code
        response_headers = dict(exc.headers)
    if expected is not None and status != expected:
        raise AssertionError(f"{method} {path} expected {expected}, got {status}: {parsed}")
    return {"status": status, "body": parsed, "headers": response_headers}


def main():
    checks = []
    health = call("GET", "/health", expected=200)
    checks.append({"name": "health", "status": health["status"]})
    ready = call("GET", "/ready", expected=200)
    if ready["body"].get("mode") != "remote-postgres":
        raise AssertionError(f"readiness did not report remote-postgres mode: {ready['body']}")
    checks.append({"name": "readiness", "status": ready["status"], "seeded_users": ready["body"].get("seededUsers")})

    budi = call("POST", "/login", data={"username": "budi", "password": "password123"}, expected=200)["body"]
    admin = call("POST", "/login", data={"username": "admin", "password": "admin12345"}, expected=200)["body"]
    checks.append({"name": "login", "status": 200})

    call("GET", "/me", token=budi["access_token"], expected=200)
    call("GET", "/me/accounts", token=budi["access_token"], expected=200)
    call("GET", "/accounts/ACC-MAYA-001", token=budi["access_token"], expected=200)
    call("GET", "/accounts/2", token=budi["access_token"], expected=403)
    call("GET", "/accounts/ACC-MAYA-001", token=budi["access_token"], expected=403, base_url=SECURE_URL)
    call("GET", "/transactions/TRX-MAYA-001", token=budi["access_token"], expected=200)
    call("GET", "/transactions/TRX-MAYA-001", token=budi["access_token"], expected=403, base_url=SECURE_URL)
    transfer_payload = {
        "sourceAccountId": "ACC-MAYA-001",
        "destinationAccountId": "ACC-NADIA-001",
        "amount": 125000,
        "note": "synthetic transfer ledger smoke",
    }
    call("POST", "/transfers", token=budi["access_token"], json_body=transfer_payload, expected=201)
    call("POST", "/transfers", token=budi["access_token"], json_body=transfer_payload, expected=403, base_url=SECURE_URL)
    call("GET", "/admin/users", token=budi["access_token"], expected=403)
    call("GET", "/admin/users", token=admin["access_token"], expected=200)
    call("GET", "/audit/events?limit=50", token=admin["access_token"], expected=200)
    call("GET", "/pentest/evidence", token=admin["access_token"], expected=200)
    call("GET", "/segmentation/internal-db/status", expected=200)
    call("POST", "/token/refresh", token=budi["access_token"], json_body={"refresh_token": budi["refresh_token"]}, expected=200)
    summary = call("GET", "/dashboard/summary", expected=200)
    checks.append({"name": "authz_controls", "status": "passed"})
    checks.append({"name": "dashboard_summary", "risk_score": summary["body"].get("risk_score")})

    report = {
        "title": "Shield-PDP Smoke Test",
        "base_url": BASE_URL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "passed",
        "checks": checks,
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({"status": "failed", "base_url": BASE_URL, "error": str(exc)}, indent=2))
        sys.exit(1)

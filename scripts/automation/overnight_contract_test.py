"""Shield-PDP overnight integration contract checks.

This script validates the browser/BurpSuite-facing API contract for the
controlled lab. It does not print tokens or secrets.
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Any
from urllib import error, parse, request


GATEWAY_URL = os.getenv("SHIELD_PDP_GATEWAY_URL", "http://localhost:3000").rstrip("/")
TIMEOUT = float(os.getenv("SHIELD_PDP_HTTP_TIMEOUT", "8"))


class ContractFailure(AssertionError):
    pass


def request_id() -> str:
    return f"overnight-{uuid.uuid4()}"


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            if key in {"access_token", "refresh_token"}:
                redacted[key] = "<redacted>"
            else:
                redacted[key] = redact(item)
        return redacted
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def call(method: str, path: str, token: str | None = None, data: dict[str, str] | None = None, json_body: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {"Accept": "application/json", "X-Request-ID": request_id()}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        body = parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if json_body is not None:
        body = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(f"{GATEWAY_URL}{path}", data=body, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read().decode("utf-8")
            status = response.status
            content_type = response.headers.get("content-type", "")
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        status = exc.code
        content_type = exc.headers.get("content-type", "")

    parsed: Any
    if "json" in content_type:
        parsed = json.loads(raw) if raw else None
    else:
        parsed = raw[:240]
    return {"method": method, "path": path, "status": status, "body": parsed}


def expect_status(name: str, response: dict[str, Any], expected: int) -> dict[str, Any]:
    if response["status"] != expected:
        raise ContractFailure(f"{name}: expected HTTP {expected}, got {response['status']} for {response['method']} {response['path']}: {redact(response['body'])}")
    return {
        "scenario": name,
        "endpoint": f"{response['method']} {response['path']}",
        "httpStatus": response["status"],
        "body": redact(response["body"]),
    }


def require_field(name: str, response: dict[str, Any], field: str) -> Any:
    body = response.get("body")
    if not isinstance(body, dict) or not body.get(field):
        raise ContractFailure(f"{name}: missing required field {field}: {redact(body)}")
    return body[field]


def main() -> int:
    checks: list[dict[str, Any]] = []

    ready = call("GET", "/api/v1/vulnerable/ready")
    checks.append(expect_status("remote postgres readiness", ready, 200))
    ready_body = ready["body"]
    if not isinstance(ready_body, dict) or ready_body.get("database") != "ok" or ready_body.get("mode") != "remote-postgres":
        raise ContractFailure(f"readiness response did not confirm remote postgres mode: {redact(ready_body)}")

    budi_login = call("POST", "/api/v1/vulnerable/login", data={"username": "budi", "password": "password123"})
    checks.append(expect_status("login as Budi", budi_login, 200))
    budi_token = require_field("login as Budi", budi_login, "access_token")

    admin_login = call("POST", "/api/v1/vulnerable/login", data={"username": "admin", "password": "admin12345"})
    checks.append(expect_status("login as admin", admin_login, 200))
    admin_token = require_field("login as admin", admin_login, "access_token")

    vulnerable_account = call("GET", "/api/v1/vulnerable/accounts/ACC-MAYA-001", token=budi_token)
    checks.append(expect_status("vulnerable account IDOR allows cross-owner read", vulnerable_account, 200))
    secure_account = call("GET", "/api/v1/secure/accounts/ACC-MAYA-001", token=budi_token)
    checks.append(expect_status("secure account control blocks cross-owner read", secure_account, 403))

    vulnerable_transaction = call("GET", "/api/v1/vulnerable/transactions/TRX-MAYA-001", token=budi_token)
    checks.append(expect_status("vulnerable transaction IDOR allows cross-owner read", vulnerable_transaction, 200))
    secure_transaction = call("GET", "/api/v1/secure/transactions/TRX-MAYA-001", token=budi_token)
    checks.append(expect_status("secure transaction control blocks cross-owner read", secure_transaction, 403))

    transfer_payload = {
        "sourceAccountId": "ACC-MAYA-001",
        "destinationAccountId": "ACC-NADIA-001",
        "amount": 125000,
        "note": "synthetic transfer ledger contract",
    }
    vulnerable_transfer = call("POST", "/api/v1/vulnerable/transfers", token=budi_token, json_body=transfer_payload)
    checks.append(expect_status("vulnerable transfer trusts modified sourceAccountId", vulnerable_transfer, 201))
    secure_transfer = call("POST", "/api/v1/secure/transfers", token=budi_token, json_body=transfer_payload)
    checks.append(expect_status("secure transfer validates sourceAccountId ownership", secure_transfer, 403))

    admin_denied = call("GET", "/api/v1/vulnerable/admin/users", token=budi_token)
    checks.append(expect_status("customer admin route attempt is denied", admin_denied, 403))

    segmentation = call("GET", "/api/v1/vulnerable/segmentation/internal-db/status", token=budi_token)
    checks.append(expect_status("segmentation evidence is available", segmentation, 200))

    audit = call("GET", "/api/v1/vulnerable/audit/events?limit=50", token=admin_token)
    checks.append(expect_status("admin can fetch audit events", audit, 200))

    evidence = call("GET", "/api/v1/vulnerable/pentest/evidence", token=admin_token)
    checks.append(expect_status("admin can fetch pentest evidence", evidence, 200))

    report = {
        "title": "Shield-PDP Overnight API Contract",
        "gatewayUrl": GATEWAY_URL,
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
        print(json.dumps({"status": "failed", "gatewayUrl": GATEWAY_URL, "error": str(exc)}, indent=2))
        sys.exit(1)

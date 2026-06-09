"""Validate Shield-PDP synthetic transfer ledger posting.

The script uses only controlled lab accounts and never prints access tokens.
Successful vulnerable transfer checks intentionally post synthetic ledger rows
and update demo balances in PostgreSQL.
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
TRANSFER_AMOUNT = float(os.getenv("SHIELD_PDP_LEDGER_TEST_AMOUNT", "125000"))
LAN_ORIGIN = os.getenv("SHIELD_PDP_LAN_ORIGIN", "http://192.168.18.205:3200")


class LedgerFailure(AssertionError):
    pass


def request_id() -> str:
    return f"ledger-{uuid.uuid4()}"


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "<redacted>" if key in {"access_token", "refresh_token"} else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def call(
    method: str,
    path: str,
    *,
    token: str | None = None,
    form: dict[str, str] | None = None,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {"Accept": "application/json", "X-Request-ID": request_id()}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if form is not None:
        body = parse.urlencode(form).encode("utf-8")
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

    if "json" in content_type:
        body_value: Any = json.loads(raw) if raw else None
    else:
        body_value = raw[:240]
    return {"method": method, "path": path, "status": status, "body": body_value}


def cors_preflight(path: str, headers: str) -> dict[str, Any]:
    req = request.Request(
        f"{GATEWAY_URL}{path}",
        headers={
            "Origin": LAN_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": headers,
        },
        method="OPTIONS",
    )
    try:
        with request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read().decode("utf-8")
            return {
                "method": "OPTIONS",
                "path": path,
                "status": response.status,
                "body": raw,
                "allowed_origin": response.headers.get("access-control-allow-origin"),
                "allowed_headers": response.headers.get("access-control-allow-headers", ""),
            }
    except error.HTTPError as exc:
        return {
            "method": "OPTIONS",
            "path": path,
            "status": exc.code,
            "body": exc.read().decode("utf-8"),
            "allowed_origin": exc.headers.get("access-control-allow-origin"),
            "allowed_headers": exc.headers.get("access-control-allow-headers", ""),
        }


def expect_status(name: str, response: dict[str, Any], expected: int) -> None:
    if response["status"] != expected:
        raise LedgerFailure(
            f"{name}: expected HTTP {expected}, got {response['status']} for "
            f"{response['method']} {response['path']}: {redact(response['body'])}"
        )


def expect_transfer_cors() -> None:
    headers = "authorization,content-type,idempotency-key,x-idempotency-key,x-request-id"
    response = cors_preflight("/api/v1/vulnerable/transfers", headers)
    expect_status("transfer CORS preflight", response, 200)
    if response.get("allowed_origin") != LAN_ORIGIN:
        raise LedgerFailure(f"transfer CORS preflight: expected origin {LAN_ORIGIN}, got {response.get('allowed_origin')}")
    allowed_headers = {item.strip().lower() for item in str(response.get("allowed_headers", "")).split(",")}
    missing = {item.strip().lower() for item in headers.split(",")} - allowed_headers
    if missing:
        raise LedgerFailure(f"transfer CORS preflight: missing allowed headers {sorted(missing)}")


def body_dict(name: str, response: dict[str, Any]) -> dict[str, Any]:
    body = response.get("body")
    if not isinstance(body, dict):
        raise LedgerFailure(f"{name}: expected JSON object body, got {redact(body)}")
    return body


def require_field(name: str, body: dict[str, Any], field: str) -> Any:
    value = body.get(field)
    if value in {None, ""}:
        raise LedgerFailure(f"{name}: missing required field {field}: {redact(body)}")
    return value


def login(username: str, password: str) -> str:
    response = call(
        "POST",
        "/api/v1/vulnerable/login",
        form={"username": username, "password": password},
    )
    expect_status(f"login as {username}", response, 200)
    body = body_dict(f"login as {username}", response)
    return str(require_field(f"login as {username}", body, "access_token"))


def get_account(token: str, account_id: str) -> dict[str, Any]:
    response = call("GET", f"/api/v1/vulnerable/accounts/{account_id}", token=token)
    expect_status(f"get account {account_id}", response, 200)
    return body_dict(f"get account {account_id}", response)


def get_transactions(token: str) -> list[dict[str, Any]]:
    response = call("GET", "/api/v1/vulnerable/me/transactions", token=token)
    expect_status("get own transactions", response, 200)
    body = body_dict("get own transactions", response)
    items = body.get("items")
    if not isinstance(items, list):
        raise LedgerFailure(f"transaction list did not return items array: {redact(body)}")
    return [item for item in items if isinstance(item, dict)]


def post_transfer(token: str, source: str, destination: str, amount: float, note: str, *, secure: bool = False) -> dict[str, Any]:
    path = "/api/v1/secure/transfers" if secure else "/api/v1/vulnerable/transfers"
    response = call(
        "POST",
        path,
        token=token,
        json_body={
            "sourceAccountId": source,
            "destinationAccountId": destination,
            "amount": amount,
            "note": note,
        },
    )
    if secure:
        expect_status("secure transfer blocked", response, 403)
    else:
        expect_status("vulnerable transfer posted", response, 201)
    return body_dict("transfer response", response)


def balance(account: dict[str, Any]) -> float:
    return float(account.get("balance", 0))


def assert_amount_delta(name: str, before: float, after: float, expected_delta: float) -> None:
    actual_delta = round(after - before, 2)
    expected = round(expected_delta, 2)
    if abs(actual_delta - expected) > 0.01:
        raise LedgerFailure(f"{name}: expected delta {expected}, got {actual_delta} (before={before}, after={after})")


def assert_transaction_visible(transactions: list[dict[str, Any]], transaction_id: str, direction: str, transfer_id: str) -> None:
    for item in transactions:
        if item.get("transactionId") == transaction_id or item.get("id") == transaction_id:
            if item.get("direction") != direction:
                raise LedgerFailure(f"{transaction_id}: expected direction {direction}, got {item.get('direction')}")
            if item.get("transferId") != transfer_id:
                raise LedgerFailure(f"{transaction_id}: expected transferId {transfer_id}, got {item.get('transferId')}")
            return
    raise LedgerFailure(f"transaction {transaction_id} not present in own transaction list")


def main() -> int:
    expect_transfer_cors()

    budi_token = login("budi", "password123")
    maya_token = login("maya", "password123")
    nadia_token = login("nadia", "password123")

    budi_before = balance(get_account(budi_token, "ACC-BUDI-001"))
    nadia_before = balance(get_account(nadia_token, "ACC-NADIA-001"))
    normal = post_transfer(
        budi_token,
        "ACC-BUDI-001",
        "ACC-NADIA-001",
        TRANSFER_AMOUNT,
        "synthetic transfer ledger regression",
    )
    transfer_id = str(require_field("normal transfer", normal, "transferId"))
    source_transaction_id = str(require_field("normal transfer", normal, "sourceTransactionId"))
    destination_transaction_id = str(require_field("normal transfer", normal, "destinationTransactionId"))
    if normal.get("idorDetected") not in {False, 0}:
        raise LedgerFailure(f"normal transfer should not be IDOR-detected: {redact(normal)}")

    budi_after = balance(get_account(budi_token, "ACC-BUDI-001"))
    nadia_after = balance(get_account(nadia_token, "ACC-NADIA-001"))
    assert_amount_delta("Budi legitimate transfer balance", budi_before, budi_after, -TRANSFER_AMOUNT)
    assert_amount_delta("Nadia legitimate transfer balance", nadia_before, nadia_after, TRANSFER_AMOUNT)
    assert_transaction_visible(get_transactions(budi_token), source_transaction_id, "out", transfer_id)
    assert_transaction_visible(get_transactions(nadia_token), destination_transaction_id, "in", transfer_id)

    maya_before = balance(get_account(budi_token, "ACC-MAYA-001"))
    nadia_before_idor = balance(get_account(nadia_token, "ACC-NADIA-001"))
    idor = post_transfer(
        budi_token,
        "ACC-MAYA-001",
        "ACC-NADIA-001",
        TRANSFER_AMOUNT,
        "sourceAccountId tampered in Burp",
    )
    require_field("IDOR transfer", idor, "evidenceId")
    require_field("IDOR transfer", idor, "auditEventId")
    if idor.get("sourceAccountOwner") != "CUST-MAYA":
        raise LedgerFailure(f"IDOR transfer should report CUST-MAYA source owner: {redact(idor)}")
    if idor.get("idorDetected") not in {True, 1}:
        raise LedgerFailure(f"IDOR transfer should set idorDetected=true: {redact(idor)}")
    if idor.get("risk") not in {"high", "critical"}:
        raise LedgerFailure(f"IDOR transfer should be high or critical risk: {redact(idor)}")

    maya_after = balance(get_account(budi_token, "ACC-MAYA-001"))
    nadia_after_idor = balance(get_account(nadia_token, "ACC-NADIA-001"))
    assert_amount_delta("Maya vulnerable IDOR transfer balance", maya_before, maya_after, -TRANSFER_AMOUNT)
    assert_amount_delta("Nadia vulnerable IDOR transfer balance", nadia_before_idor, nadia_after_idor, TRANSFER_AMOUNT)

    maya_before_secure = balance(get_account(budi_token, "ACC-MAYA-001"))
    maya_transactions_before = len(get_transactions(maya_token))
    secure_body = post_transfer(
        budi_token,
        "ACC-MAYA-001",
        "ACC-NADIA-001",
        TRANSFER_AMOUNT,
        "secure sourceAccountId tamper should block",
        secure=True,
    )
    detail = secure_body.get("detail")
    if not isinstance(detail, dict):
        raise LedgerFailure(f"secure blocked response should include detail object: {redact(secure_body)}")
    require_field("secure blocked transfer", detail, "auditEventId")
    require_field("secure blocked transfer", detail, "evidenceId")
    maya_after_secure = balance(get_account(budi_token, "ACC-MAYA-001"))
    maya_transactions_after = len(get_transactions(maya_token))
    assert_amount_delta("Maya secure blocked transfer balance", maya_before_secure, maya_after_secure, 0)
    if maya_transactions_after != maya_transactions_before:
        raise LedgerFailure(
            f"secure blocked transfer inserted transactions: before={maya_transactions_before}, after={maya_transactions_after}"
        )

    report = {
        "title": "Shield-PDP Transfer Ledger Test",
        "gatewayUrl": GATEWAY_URL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "passed",
        "amount": TRANSFER_AMOUNT,
        "checks": [
            "LAN CORS preflight allows transfer idempotency headers",
            "legitimate vulnerable transfer posts debit and credit ledger entries",
            "vulnerable sourceAccountId tampering posts ledger and evidence",
            "secure sourceAccountId tampering returns 403 without ledger mutation",
        ],
    }
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(json.dumps({"status": "failed", "gatewayUrl": GATEWAY_URL, "error": str(exc)}, indent=2))
        sys.exit(1)

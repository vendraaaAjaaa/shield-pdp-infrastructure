import json
import os
import sys
import uuid
from datetime import datetime, timezone
from urllib import error, parse, request


BASE_URL = os.getenv("SHIELD_PDP_ENTERPRISE_URL", "http://localhost:3100").rstrip("/")
TIMEOUT = float(os.getenv("SHIELD_PDP_HTTP_TIMEOUT", "5"))
SERVICE_SECRET = os.getenv("SERVICE_ACCOUNT_SECRET", "shield-service-account-lab-secret")


def call(method, path, token=None, data=None, json_body=None, expected=None, accept_json=True):
    request_id = f"stage2-{uuid.uuid4()}"
    headers = {"X-Request-ID": request_id}
    body = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        body = parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if json_body is not None:
        body = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
            status = resp.status
            response_headers = dict(resp.headers)
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        status = exc.code
        response_headers = dict(exc.headers)

    parsed = None
    if raw and accept_json:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
    else:
        parsed = raw

    if expected is not None and status != expected:
        raise AssertionError(f"{method} {path} expected {expected}, got {status}: {parsed}")

    return {
        "status": status,
        "body": parsed,
        "headers": response_headers,
        "request_id": request_id,
    }


def login(username, password):
    response = call(
        "POST",
        "/identity/oauth/token",
        data={"grant_type": "password", "username": username, "password": password},
        expected=200,
    )
    token = response["body"].get("access_token")
    if not token:
        raise AssertionError(f"missing access token for {username}")
    return token


def service_token(client_id):
    response = call(
        "POST",
        "/identity/oauth/token",
        json_body={"grant_type": "client_credentials", "client_id": client_id, "client_secret": SERVICE_SECRET},
        expected=200,
    )
    token = response["body"].get("access_token")
    if not token:
        raise AssertionError(f"missing service token for {client_id}")
    return token


def header_value(response, name):
    target = name.lower()
    for key, value in response["headers"].items():
        if key.lower() == target:
            return value
    return None


def main():
    checks = []

    health = call("GET", "/health", expected=200)
    checks.append({"name": "enterprise_gateway_health", "status": health["status"]})

    call("GET", "/employee/api/summary", expected=401, accept_json=False)
    checks.append({"name": "gateway_requires_auth", "status": "passed"})

    alice = login("alice.employee", "EmployeePass123!")
    hr = login("rani.hr", "HrPass123!")
    finance = login("budi.finance", "FinancePass123!")
    developer = login("dimas.dev", "DeveloperPass123!")
    admin = login("admin.enterprise", "AdminPass123!")

    employee_summary = call("GET", "/employee/api/summary", token=alice, expected=200)
    if header_value(employee_summary, "X-Request-ID") != employee_summary["request_id"]:
        raise AssertionError("enterprise gateway did not preserve X-Request-ID")
    checks.append({"name": "employee_portal_access", "portal": employee_summary["body"].get("portal")})

    call("GET", "/internal/hr/api/summary", token=alice, expected=403, accept_json=False)
    checks.append({"name": "hr_route_blocks_employee", "status": "passed"})

    hr_summary = call("GET", "/internal/hr/api/summary", token=hr, expected=200)
    finance_summary = call("GET", "/internal/finance/api/summary", token=finance, expected=200)
    developer_summary = call("GET", "/developer/api/summary", token=developer, expected=200)
    admin_summary = call("GET", "/internal/admin/api/summary", token=admin, expected=200)
    checks.extend(
        [
            {"name": "hr_portal_access", "portal": hr_summary["body"].get("portal")},
            {"name": "finance_portal_access", "portal": finance_summary["body"].get("portal")},
            {"name": "developer_dashboard_access", "portal": developer_summary["body"].get("portal")},
            {"name": "admin_dashboard_access", "portal": admin_summary["body"].get("portal")},
        ]
    )

    introspection = call("POST", "/identity/oauth/introspect", json_body={"token": alice}, expected=200)
    if not introspection["body"].get("active"):
        raise AssertionError("identity introspection did not mark valid token active")
    checks.append({"name": "token_introspection", "active": True})

    svc_token = service_token("developer-dashboard")
    svc_introspection = call("POST", "/identity/oauth/introspect", json_body={"token": svc_token}, expected=200)
    if not svc_introspection["body"].get("service_account"):
        raise AssertionError("service account token missing service_account claim")
    checks.append({"name": "service_account_token", "client_id": svc_introspection["body"].get("client_id")})

    service_health = call("GET", "/observability/service-health", token=admin, expected=200)
    if service_health["body"].get("healthy", 0) < 7:
        raise AssertionError(f"expected at least 7 healthy services, got {service_health['body']}")
    checks.append({"name": "observability_service_health", "healthy": service_health["body"].get("healthy")})

    log_summary = call("GET", "/logs/events/summary", token=admin, expected=200)
    checks.append({"name": "centralized_log_summary", "buffered_events": log_summary["body"].get("buffered_events")})

    report = {
        "title": "Shield-PDP Stage 2 Core Enterprise Infrastructure Validation",
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

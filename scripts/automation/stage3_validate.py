import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from urllib import error, parse, request


BASE_URL = os.getenv("SHIELD_PDP_ENTERPRISE_URL", "http://localhost:3100").rstrip("/")
TIMEOUT = float(os.getenv("SHIELD_PDP_HTTP_TIMEOUT", "5"))
SERVICE_SECRET = os.getenv("SERVICE_ACCOUNT_SECRET", "shield-service-account-lab-secret")


def call(method, path, token=None, data=None, json_body=None, expected=None, accept_json=True, extra_headers=None):
    request_id = f"stage3-{uuid.uuid4()}"
    headers = {"X-Request-ID": request_id}
    if extra_headers:
        headers.update(extra_headers)
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

    return {"status": status, "body": parsed, "headers": response_headers, "request_id": request_id}


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


def main():
    checks = []

    health = call("GET", "/health", expected=200)
    checks.append({"name": "enterprise_gateway_health", "status": health["status"]})

    alice = login("alice.employee", "EmployeePass123!")
    developer = login("dimas.dev", "DeveloperPass123!")
    admin = login("admin.enterprise", "AdminPass123!")

    direct_metadata = call(
        "GET",
        "/service-discovery/internal/metadata/instance",
        token=alice,
        expected=404,
        accept_json=False,
    )
    checks.append({"name": "gateway_blocks_direct_metadata_route", "status": direct_metadata["status"]})

    audience_lab = call("GET", "/identity/lab/tokens/audience-confusion", token=developer, expected=200)
    audience_token = audience_lab["body"].get("token")
    if not audience_token:
        raise AssertionError("audience confusion lab did not return a token")
    checks.append({"name": "audience_confusion_token_issued", "audience": audience_lab["body"].get("audience")})

    legacy_accept = call(
        "POST",
        "/internal/api/lab/audience-confusion/admin-context",
        token=developer,
        json_body={"delegated_token": audience_token},
        expected=200,
    )
    if legacy_accept["body"].get("status") != "legacy_context_accepted":
        raise AssertionError(f"legacy audience validator did not accept lab token: {legacy_accept['body']}")
    checks.append({"name": "legacy_audience_confusion_path", "status": legacy_accept["body"].get("status")})

    strict_reject = call(
        "POST",
        "/internal/api/secure/admin-context",
        token=developer,
        json_body={"delegated_token": audience_token},
        expected=403,
    )
    checks.append({"name": "strict_audience_validation_rejects", "status": strict_reject["status"]})

    stale_lab = call("GET", "/identity/lab/tokens/stale", token=developer, expected=200)
    stale_token = stale_lab["body"].get("token")
    if not stale_token:
        raise AssertionError("stale token lab did not return a token")
    stale_accept = call(
        "POST",
        "/internal/api/lab/stale-session/delegated",
        token=developer,
        json_body={"delegated_token": stale_token},
        expected=200,
    )
    checks.append({"name": "legacy_stale_token_path", "status": stale_accept["body"].get("status")})

    employee_service_token = service_token("employee-portal")
    shadow_users = call("GET", "/service/internal-api/lab/admin-shadow/users", token=employee_service_token, expected=200)
    if shadow_users["body"].get("status") != "shadow_admin_scope_accepted":
        raise AssertionError(f"service account shadow admin path failed: {shadow_users['body']}")
    checks.append({"name": "service_account_trust_abuse_path", "users": len(shadow_users["body"].get("users", []))})

    preview = call(
        "POST",
        "/internal/api/lab/link-preview",
        token=developer,
        json_body={"target": "metadata"},
        expected=200,
    )
    metadata = preview["body"].get("body", {}).get("metadata", {})
    if metadata.get("service_account") != "internal-api":
        raise AssertionError(f"controlled SSRF metadata path returned unexpected body: {preview['body']}")
    checks.append({"name": "controlled_ssrf_internal_metadata", "service_account": metadata.get("service_account")})

    dns = call("GET", "/service-discovery/api/dns", token=alice, expected=200)
    if len(dns["body"].get("records", [])) < 5:
        raise AssertionError(f"service discovery DNS returned too few records: {dns['body']}")
    checks.append({"name": "internal_dns_recon_surface", "records": len(dns["body"].get("records", []))})

    ci_config = call("GET", "/devops/git/api/repos/customer-api/ci-config", token=developer, expected=200)
    pipeline_token = ci_config["body"].get("config", {}).get("variables", {}).get("PIPELINE_TOKEN")
    if not pipeline_token:
        raise AssertionError("CI config did not expose the lab pipeline token")
    checks.append({"name": "ci_config_pipeline_token_exposure", "repository": ci_config["body"].get("repository")})

    run = call(
        "POST",
        "/ci-hook/api/pipelines/customer-api/run",
        json_body={"branch": "main", "commit": "stage3-simulated", "change": "dependency-update"},
        expected=202,
        extra_headers={"X-Pipeline-Token": pipeline_token},
    )
    checks.append({"name": "token_only_pipeline_run", "run_id": run["body"].get("pipeline", {}).get("id")})

    artifact = call("GET", "/devops/artifacts/public/latest", token=alice, expected=200)
    env_snapshot = artifact["body"].get("artifact", {}).get("env_snapshot", {})
    if env_snapshot.get("INTERNAL_API_URL") != "http://internal-api:8080":
        raise AssertionError(f"artifact environment exposure missing internal API URL: {artifact['body']}")
    checks.append({"name": "artifact_environment_exposure", "artifact_id": artifact["body"].get("artifact", {}).get("artifact_id")})

    secret = call(
        "GET",
        "/lab/secrets/api/legacy-read/deploy/prod",
        expected=200,
        extra_headers={"X-Pipeline-Token": pipeline_token},
    )
    if secret["body"].get("data", {}).get("DEPLOY_API_TOKEN") != "lab-secret-synthetic-deploy-token":
        raise AssertionError(f"legacy secret broker path returned unexpected secret body: {secret['body']}")
    checks.append({"name": "legacy_pipeline_token_secret_read", "policy": secret["body"].get("policy")})

    health_report = call("GET", "/observability/service-health", token=admin, expected=200)
    if health_report["body"].get("healthy", 0) < 13:
        raise AssertionError(f"expected at least 13 healthy enterprise services, got {health_report['body']}")
    checks.append({"name": "observability_stage3_service_health", "healthy": health_report["body"].get("healthy")})

    time.sleep(1.0)
    log_summary = call("GET", "/logs/events/summary", token=admin, expected=200)
    checks.append({"name": "centralized_log_summary", "buffered_events": log_summary["body"].get("buffered_events")})

    report = {
        "title": "Shield-PDP Stage 3 Vulnerable Enterprise Ecosystem Validation",
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

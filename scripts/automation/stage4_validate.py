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
    request_id = f"stage4-{uuid.uuid4()}"
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

    parsed = raw
    if raw and accept_json:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
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


def seed_stage3_attack_telemetry(tokens):
    checks = []

    audience_lab = call("GET", "/identity/lab/tokens/audience-confusion", token=tokens["developer"], expected=200)
    audience_token = audience_lab["body"].get("token")
    call(
        "POST",
        "/internal/api/lab/audience-confusion/admin-context",
        token=tokens["developer"],
        json_body={"delegated_token": audience_token},
        expected=200,
    )
    call(
        "POST",
        "/internal/api/secure/admin-context",
        token=tokens["developer"],
        json_body={"delegated_token": audience_token},
        expected=403,
    )
    checks.append({"name": "seed_jwt_audience_confusion", "audience": audience_lab["body"].get("audience")})

    stale_lab = call("GET", "/identity/lab/tokens/stale", token=tokens["developer"], expected=200)
    call(
        "POST",
        "/internal/api/lab/stale-session/delegated",
        token=tokens["developer"],
        json_body={"delegated_token": stale_lab["body"].get("token")},
        expected=200,
    )
    checks.append({"name": "seed_stale_token_usage", "status": "accepted_by_legacy_path"})

    employee_service_token = service_token("employee-portal")
    shadow = call("GET", "/service/internal-api/lab/admin-shadow/users", token=employee_service_token, expected=200)
    checks.append({"name": "seed_service_account_misuse", "users": len(shadow["body"].get("users", []))})

    call("POST", "/internal/api/lab/link-preview", token=tokens["developer"], json_body={"target": "metadata"}, expected=200)
    dns = call("GET", "/service-discovery/api/dns", token=tokens["alice"], expected=200)
    checks.append({"name": "seed_internal_recon_and_metadata", "dns_records": len(dns["body"].get("records", []))})

    ci_config = call("GET", "/devops/git/api/repos/customer-api/ci-config", token=tokens["developer"], expected=200)
    pipeline_token = ci_config["body"].get("config", {}).get("variables", {}).get("PIPELINE_TOKEN")
    if not pipeline_token:
        raise AssertionError("CI config did not expose lab pipeline token")
    call(
        "POST",
        "/ci-hook/api/pipelines/customer-api/run",
        json_body={"branch": "main", "commit": "stage4-simulated", "change": "detection-validation"},
        expected=202,
        extra_headers={"X-Pipeline-Token": pipeline_token},
    )
    checks.append({"name": "seed_cicd_token_and_pipeline", "repository": ci_config["body"].get("repository")})

    call("GET", "/devops/artifacts/public/latest", token=tokens["alice"], expected=200)
    call("GET", "/lab/secrets/api/legacy-read/deploy/prod", expected=200, extra_headers={"X-Pipeline-Token": pipeline_token})
    checks.append({"name": "seed_artifact_and_secret_abuse", "status": "completed"})

    call("GET", "/identity/directory/users", token=tokens["alice"], expected=403)
    checks.append({"name": "seed_admin_route_anomaly", "status": 403})

    time.sleep(1.5)
    return checks


def main():
    checks = []

    call("GET", "/health", expected=200)
    checks.append({"name": "enterprise_gateway_health", "status": 200})

    tokens = {
        "alice": login("alice.employee", "EmployeePass123!"),
        "developer": login("dimas.dev", "DeveloperPass123!"),
        "soc": login("siti.soc", "SocPass123!"),
        "detect": login("nina.detect", "DetectPass123!"),
        "red": login("reza.red", "RedTeamPass123!"),
        "admin": login("admin.enterprise", "AdminPass123!"),
    }
    checks.append({"name": "stage4_roles_login", "roles": ["soc_analyst", "detection_engineer", "red_team_operator", "admin"]})

    checks.extend(seed_stage3_attack_telemetry(tokens))

    rules = call("GET", "/detections/api/rules", token=tokens["detect"], expected=200)
    if len(rules["body"].get("rules", [])) < 12:
        raise AssertionError(f"expected at least 12 detection rules, got {rules['body']}")
    checks.append({"name": "detection_rules_loaded", "rules": len(rules["body"].get("rules", []))})

    alerts = call("GET", "/detections/api/alerts?limit=800", token=tokens["soc"], expected=200)
    alert_rule_ids = {alert.get("rule_id") for alert in alerts["body"].get("alerts", [])}
    required_rules = {
        "SHIELD-S4-SSRF-001",
        "SHIELD-S4-METADATA-001",
        "SHIELD-S4-JWT-001",
        "SHIELD-S4-SECRETS-001",
        "SHIELD-S4-ADMIN-001",
        "SHIELD-S4-RECON-001",
    }
    missing = sorted(required_rules - alert_rule_ids)
    if missing:
        raise AssertionError(f"missing expected detection alerts: {missing}")
    checks.append({"name": "detection_alerts_generated", "alerts": len(alerts["body"].get("alerts", []))})

    validation = call("POST", "/detections/api/validation/run", token=tokens["detect"], json_body={"limit": 800}, expected=200)
    if validation["body"].get("validation", {}).get("coverage_percent", 0) < 80:
        raise AssertionError(f"detection validation coverage too low: {validation['body']}")
    checks.append({"name": "detection_validation_workflow", "coverage_percent": validation["body"]["validation"]["coverage_percent"]})

    siem_status = call("GET", "/siem/api/pipeline/status?limit=800", token=tokens["soc"], expected=200)
    if siem_status["body"].get("detection_alerts", 0) < 6:
        raise AssertionError(f"SIEM pipeline did not see enough alerts: {siem_status['body']}")
    checks.append({"name": "siem_pipeline_status", "alerts": siem_status["body"].get("detection_alerts")})

    normalized = call("GET", "/siem/api/normalized-events?limit=800", token=tokens["soc"], expected=200)
    wazuh = call("GET", "/siem/api/wazuh/alerts?limit=800", token=tokens["soc"], expected=200)
    opensearch = call("GET", "/siem/api/opensearch/bulk?limit=50", token=tokens["soc"], expected=200)
    if not normalized["body"].get("events") or not wazuh["body"].get("alerts") or not opensearch["body"].get("documents"):
        raise AssertionError("SIEM integration endpoints did not return normalized events, Wazuh alerts, and OpenSearch documents")
    checks.append({"name": "wazuh_opensearch_integration", "wazuh_alerts": len(wazuh["body"].get("alerts", []))})

    timeline = call("GET", "/correlation/api/timeline?limit=800", token=tokens["soc"], expected=200)
    incidents = call("GET", "/correlation/api/attack-paths?limit=800", token=tokens["soc"], expected=200)
    identities = call("GET", "/correlation/api/identity-abuse?limit=800", token=tokens["soc"], expected=200)
    if not timeline["body"].get("timeline") or not incidents["body"].get("incidents") or not identities["body"].get("principals"):
        raise AssertionError("correlation engine did not produce timeline, incidents, and identity abuse summaries")
    checks.append({"name": "attack_correlation_engine", "incidents": len(incidents["body"].get("incidents", []))})

    purple_workflow = call("GET", "/purple/api/workflow", token=tokens["red"], expected=200)
    purple_incidents = call("GET", "/purple/api/incidents?limit=800", token=tokens["soc"], expected=200)
    incident_list = purple_incidents["body"].get("incidents", [])
    if not incident_list:
        raise AssertionError("purple dashboard incident queue is empty")
    incident_id = incident_list[0].get("incident_id")
    triage = call(
        "POST",
        f"/purple/api/incidents/{incident_id}/triage",
        token=tokens["soc"],
        json_body={"status": "investigating", "note": "Stage 4 validation triage note"},
        expected=201,
    )
    replay = call("POST", "/purple/api/replay/stage3-attack-chain", token=tokens["red"], json_body={"mode": "telemetry"}, expected=202)
    if not triage["body"].get("note") or replay["body"].get("emitted_events", 0) < 8:
        raise AssertionError("purple-team triage or replay workflow failed")
    checks.append({"name": "purple_team_workflow", "workflow": purple_workflow["body"].get("workflow", {}).get("queue")})

    service_health = call("GET", "/observability/service-health", token=tokens["admin"], expected=200)
    if service_health["body"].get("healthy", 0) < 17:
        raise AssertionError(f"expected at least 17 healthy Stage 4 services, got {service_health['body']}")
    checks.append({"name": "observability_stage4_service_health", "healthy": service_health["body"].get("healthy")})

    log_summary = call("GET", "/logs/events/summary", token=tokens["admin"], expected=200)
    checks.append({"name": "centralized_log_summary", "buffered_events": log_summary["body"].get("buffered_events")})

    report = {
        "title": "Shield-PDP Stage 4 Detection, Telemetry, and Purple Team Validation",
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

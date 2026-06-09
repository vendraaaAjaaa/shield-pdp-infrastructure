import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from urllib import error, parse, request


BASE_URL = os.getenv("SHIELD_PDP_ENTERPRISE_URL", "http://localhost:3100").rstrip("/")
TIMEOUT = float(os.getenv("SHIELD_PDP_HTTP_TIMEOUT", "5"))


def call(method, path, token=None, data=None, json_body=None, expected=None, accept_json=True, extra_headers=None):
    request_id = f"stage5-{uuid.uuid4()}"
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


def required_rule_ids():
    return {
        "SHIELD-S5-BEACON-001",
        "SHIELD-S5-REDIRECTOR-001",
        "SHIELD-S5-PIVOT-001",
        "SHIELD-S5-PERSIST-001",
        "SHIELD-S5-OPSEC-001",
        "SHIELD-S5-CAMPAIGN-001",
        "SHIELD-S5-REPLAY-001",
    }


def main():
    checks = []

    gateway = call("GET", "/", expected=200)
    routes = set(gateway["body"].get("routes", []))
    for route in ["/ops/", "/beacons/", "/redirector/", "/pivots/", "/persistence/"]:
        if route not in routes:
            raise AssertionError(f"gateway route missing: {route}")
    checks.append({"name": "enterprise_gateway_stage5_routes", "routes": sorted(route for route in routes if route in {"/ops/", "/beacons/", "/redirector/", "/pivots/", "/persistence/"})})

    tokens = {
        "red": login("reza.red", "RedTeamPass123!"),
        "soc": login("siti.soc", "SocPass123!"),
        "detect": login("nina.detect", "DetectPass123!"),
        "admin": login("admin.enterprise", "AdminPass123!"),
    }
    checks.append({"name": "stage5_roles_login", "roles": ["red_team_operator", "soc_analyst", "detection_engineer", "admin"]})

    campaigns = call("GET", "/ops/api/campaigns", token=tokens["red"], expected=200)
    campaign_ids = {item.get("id") for item in campaigns["body"].get("campaigns", [])}
    expected_campaigns = {"insider-threat-simulation", "cicd-compromise-simulation", "token-abuse-campaign", "internal-recon-campaign", "secrets-abuse-campaign"}
    missing_campaigns = sorted(expected_campaigns - campaign_ids)
    if missing_campaigns:
        raise AssertionError(f"missing adversary campaigns: {missing_campaigns}")
    run = call("POST", "/ops/api/campaigns/token-abuse-campaign/run", token=tokens["red"], json_body={"mode": "controlled"}, expected=202)
    operation_run = run["body"].get("operation_run", {})
    if operation_run.get("status") != "completed" or len(operation_run.get("emitted_events", [])) < 4:
        raise AssertionError(f"controlled campaign run did not complete: {operation_run}")
    checks.append({"name": "controlled_campaign_run", "run_id": operation_run.get("run_id")})

    profiles = call("GET", "/beacons/api/profiles", token=tokens["red"], expected=200)
    if "simulate_command" not in profiles["body"].get("safe_task_types", []):
        raise AssertionError("beacon simulator did not expose the safe synthetic command task")
    session_response = call(
        "POST",
        "/beacons/api/sessions",
        token=tokens["red"],
        json_body={"profile_id": "low-and-slow", "callback_interval_seconds": 45, "jitter_percent": 25, "mode": "low-noise"},
        expected=201,
    )
    session = session_response["body"].get("session", {})
    session_id = session.get("session_id")
    if not session_id:
        raise AssertionError("beacon session was not created")
    heartbeat = call("POST", f"/beacons/api/sessions/{session_id}/heartbeat", token=tokens["red"], json_body={}, expected=200)
    task = call(
        "POST",
        f"/beacons/api/sessions/{session_id}/tasks",
        token=tokens["red"],
        json_body={"task_type": "simulate_command", "command_profile": "service-health-profile"},
        expected=202,
    )
    rejected = call(
        "POST",
        f"/beacons/api/sessions/{session_id}/tasks",
        token=tokens["red"],
        json_body={"task_type": "simulate_command", "command": "whoami"},
        expected=400,
    )
    if heartbeat["body"].get("heartbeat", {}).get("count") != 1 or task["body"].get("task", {}).get("status") != "simulated_completed":
        raise AssertionError("beacon heartbeat or safe task simulation failed")
    if rejected["body"].get("error") != "raw_command_rejected":
        raise AssertionError("beacon simulator did not reject raw command input")
    checks.append({"name": "controlled_beacon_simulation", "session_id": session_id, "raw_command_rejected": True})

    redirect = call(
        "POST",
        "/redirector/api/routes/simulate",
        token=tokens["red"],
        json_body={"profile_id": "business-hours-low-noise", "route_id": "edge-to-beacon"},
        expected=202,
    )
    if redirect["body"].get("route_event", {}).get("external_callback") is not False:
        raise AssertionError("redirector simulation allowed an external callback")
    checks.append({"name": "redirector_traffic_shaping", "route_id": redirect["body"].get("route_event", {}).get("route_id")})

    pivot = call(
        "POST",
        "/pivots/api/pivots/simulate",
        token=tokens["red"],
        json_body={"path_id": "service-account-pivot"},
        expected=202,
    )
    if pivot["body"].get("pivot", {}).get("controls", {}).get("exploit_execution") is not False:
        raise AssertionError("pivot simulation did not enforce exploit_execution=false")
    checks.append({"name": "lateral_movement_simulation", "path_id": pivot["body"].get("pivot", {}).get("path_id")})

    persistence = call(
        "POST",
        "/persistence/api/register",
        token=tokens["red"],
        json_body={"mechanism_id": "scheduled-task-sim", "target_scope": "developer-workstation-sim"},
        expected=201,
    )
    persistence_id = persistence["body"].get("persistence", {}).get("persistence_id")
    cleanup = call("POST", "/persistence/api/cleanup", token=tokens["red"], json_body={"persistence_id": persistence_id}, expected=200)
    if not persistence_id or not cleanup["body"].get("cleaned"):
        raise AssertionError("persistence simulation cleanup failed")
    checks.append({"name": "reversible_persistence_simulation", "persistence_id": persistence_id})

    replay = call(
        "POST",
        "/purple/api/replay/adversary-timeline",
        token=tokens["red"],
        json_body={"campaign_id": "internal-recon-campaign"},
        expected=202,
    )
    if replay["body"].get("emitted_events", 0) < 5:
        raise AssertionError(f"adversary replay emitted too few events: {replay['body']}")
    checks.append({"name": "purple_team_adversary_replay", "replay_id": replay["body"].get("replay_id")})

    time.sleep(2.5)

    rules = call("GET", "/detections/api/rules", token=tokens["detect"], expected=200)
    observed_rules = {rule.get("id") for rule in rules["body"].get("rules", [])}
    missing_rules = sorted(required_rule_ids() - observed_rules)
    if missing_rules:
        raise AssertionError(f"Stage 5 detection rules missing from engine: {missing_rules}")
    checks.append({"name": "stage5_detection_rules_loaded", "stage5_rules": len(required_rule_ids())})

    alerts = call("GET", "/detections/api/alerts?limit=1000", token=tokens["soc"], expected=200)
    alert_rule_ids = {alert.get("rule_id") for alert in alerts["body"].get("alerts", [])}
    missing_alerts = sorted(required_rule_ids() - alert_rule_ids)
    if missing_alerts:
        raise AssertionError(f"missing expected Stage 5 alerts: {missing_alerts}")
    checks.append({"name": "stage5_detection_alerts_generated", "alerts": len(alerts["body"].get("alerts", []))})

    validation = call("POST", "/detections/api/validation/run", token=tokens["detect"], json_body={"stage": "stage5", "limit": 1000}, expected=200)
    coverage = validation["body"].get("validation", {}).get("coverage_percent", 0)
    if coverage < 85:
        raise AssertionError(f"Stage 5 detection validation coverage too low: {validation['body']}")
    checks.append({"name": "stage5_detection_validation", "coverage_percent": coverage})

    siem_status = call("GET", "/siem/api/pipeline/status?limit=1000", token=tokens["soc"], expected=200)
    wazuh = call("GET", "/siem/api/wazuh/alerts?limit=1000", token=tokens["soc"], expected=200)
    wazuh_rule_ids = {alert.get("rule", {}).get("id") for alert in wazuh["body"].get("alerts", [])}
    if siem_status["body"].get("detection_alerts", 0) < len(required_rule_ids()) or not required_rule_ids().issubset(wazuh_rule_ids):
        raise AssertionError("SIEM/Wazuh-compatible pipeline did not expose all Stage 5 alerts")
    checks.append({"name": "siem_stage5_alert_pipeline", "alerts": siem_status["body"].get("detection_alerts")})

    timeline = call("GET", "/correlation/api/timeline?limit=1000", token=tokens["soc"], expected=200)
    incidents = call("GET", "/correlation/api/attack-paths?limit=1000", token=tokens["soc"], expected=200)
    if not any(item.get("event_name", "").startswith("adversary.") for item in timeline["body"].get("timeline", [])):
        raise AssertionError("correlation timeline does not include Stage 5 adversary events")
    if not any(str(rule_id).startswith("SHIELD-S5") for incident in incidents["body"].get("incidents", []) for rule_id in incident.get("rule_ids", [])):
        raise AssertionError("correlation incidents do not include Stage 5 rule IDs")
    checks.append({"name": "attack_correlation_stage5", "incidents": len(incidents["body"].get("incidents", []))})

    operator_sessions = call("GET", "/ops/api/operator-sessions", token=tokens["red"], expected=200)
    heatmap = call("GET", "/ops/api/heatmap", token=tokens["red"], expected=200)
    if not operator_sessions["body"].get("operator_sessions") or not heatmap["body"].get("heatmap"):
        raise AssertionError("adversary operations dashboard data is incomplete")
    checks.append({"name": "operational_dashboard_data", "beacons": operator_sessions["body"].get("active_beacon_sessions")})

    service_health = call("GET", "/observability/service-health", token=tokens["admin"], expected=200)
    if service_health["body"].get("healthy", 0) < 22:
        raise AssertionError(f"expected at least 22 healthy Stage 5 services, got {service_health['body']}")
    checks.append({"name": "observability_stage5_service_health", "healthy": service_health["body"].get("healthy")})

    log_summary = call("GET", "/logs/events/summary", token=tokens["admin"], expected=200)
    services_seen = set(log_summary["body"].get("services", {}).keys())
    expected_services = {"adversary-control", "beacon-sim", "redirector-sim", "pivot-sim", "persistence-sim"}
    if not expected_services.issubset(services_seen):
        raise AssertionError(f"centralized logs missing Stage 5 services: {sorted(expected_services - services_seen)}")
    checks.append({"name": "centralized_stage5_logging", "stage5_services_seen": sorted(expected_services)})

    report = {
        "title": "Shield-PDP Stage 5 Adversary Operations and Controlled Red Team Simulation Validation",
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

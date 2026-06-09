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
    request_id = f"stage6-{uuid.uuid4()}"
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
        "SHIELD-S6-DIGITAL-TWIN-001",
        "SHIELD-S6-ATTACK-GRAPH-001",
        "SHIELD-S6-AUTO-CAMPAIGN-001",
        "SHIELD-S6-HUNT-001",
        "SHIELD-S6-COVERAGE-001",
        "SHIELD-S6-CHAOS-001",
        "SHIELD-S6-REPLAY-001",
        "SHIELD-S6-AI-DEFENSE-001",
    }


def main():
    checks = []

    gateway = call("GET", "/", expected=200)
    routes = set(gateway["body"].get("routes", []))
    expected_routes = {"/digital-twin/", "/attack-graph/", "/campaigns/", "/hunt/", "/coverage/", "/chaos/", "/intelligence/"}
    missing_routes = sorted(expected_routes - routes)
    if missing_routes:
        raise AssertionError(f"gateway Stage 6 routes missing: {missing_routes}")
    checks.append({"name": "enterprise_gateway_stage6_routes", "routes": sorted(expected_routes)})

    tokens = {
        "soc": login("siti.soc", "SocPass123!"),
        "detect": login("nina.detect", "DetectPass123!"),
        "red": login("reza.red", "RedTeamPass123!"),
        "admin": login("admin.enterprise", "AdminPass123!"),
    }
    checks.append({"name": "stage6_roles_login", "roles": ["soc_analyst", "threat_hunter", "detection_engineer", "red_team_operator", "admin"]})

    generated = call(
        "POST",
        "/digital-twin/api/activity/generate",
        token=tokens["soc"],
        json_body={"profile_id": "off-hours-anomaly", "count": 16, "timezone": "Asia/Jakarta", "include_off_hours": True},
        expected=202,
    )
    activity = generated["body"].get("generated", [])
    if len(activity) < 10 or not all(item.get("synthetic_background_activity") for item in activity):
        raise AssertionError("digital twin did not generate tagged synthetic background activity")
    if not any(item.get("off_hours") for item in activity):
        raise AssertionError("digital twin did not generate off-hours training activity")
    checks.append({"name": "digital_twin_activity_generation", "events": len(activity)})

    graph = call("GET", "/attack-graph/api/graph?limit=900", token=tokens["soc"], expected=200)
    graph_body = graph["body"].get("graph", {})
    if graph_body.get("summary", {}).get("nodes", 0) < 10 or graph_body.get("summary", {}).get("edges", 0) < 10:
        raise AssertionError("attack graph did not include expected nodes and edges")
    paths = call("GET", "/attack-graph/api/paths/privilege-escalation?limit=900", token=tokens["soc"], expected=200)
    blast = call("GET", "/attack-graph/api/blast-radius?service=secrets-broker", token=tokens["soc"], expected=200)
    if not paths["body"].get("paths") or blast["body"].get("blast_radius", {}).get("reachable_count", 0) < 1:
        raise AssertionError("attack graph privilege path or blast-radius analysis failed")
    checks.append({"name": "dynamic_attack_graph", "nodes": graph_body.get("summary", {}).get("nodes"), "paths": len(paths["body"].get("paths", []))})

    campaign = call(
        "POST",
        "/campaigns/api/campaigns/run",
        token=tokens["red"],
        json_body={"template_id": "cicd-pivot-chaos-aware", "stealth_profile": "low-and-slow", "randomize": True},
        expected=202,
    )
    campaign_run = campaign["body"].get("campaign_run", {})
    if campaign_run.get("status") != "completed" or campaign_run.get("controls", {}).get("exploit_execution") is not False:
        raise AssertionError(f"controlled campaign orchestration failed safety checks: {campaign_run}")
    replay_export = call("GET", f"/campaigns/api/campaigns/{campaign_run.get('run_id')}/replay-export", token=tokens["red"], expected=200)
    if not replay_export["body"].get("deterministic"):
        raise AssertionError("campaign replay export is not deterministic")
    checks.append({"name": "autonomous_campaign_orchestration", "run_id": campaign_run.get("run_id")})

    hunt = call(
        "POST",
        "/hunt/api/query",
        token=tokens["soc"],
        json_body={"query_type": "identity_abuse", "indicator": "T1550.001", "limit": 900},
        expected=200,
    )
    workspace_note = call(
        "POST",
        "/hunt/api/workspace/notes",
        token=tokens["soc"],
        json_body={"title": "Stage 6 hunt validation", "note": "Synthetic identity abuse hunt completed."},
        expected=201,
    )
    if hunt["body"].get("hunt", {}).get("match_count", -1) < 0 or not workspace_note["body"].get("note"):
        raise AssertionError("threat hunting query or workspace update failed")
    checks.append({"name": "threat_hunting_workflow", "matches": hunt["body"].get("hunt", {}).get("match_count")})

    heatmap = call("GET", "/coverage/api/attack-heatmap?limit=900", token=tokens["detect"], expected=200)
    matrix = call("GET", "/coverage/api/matrix?limit=900", token=tokens["detect"], expected=200)
    blindspots = call("GET", "/coverage/api/blindspots?limit=900", token=tokens["detect"], expected=200)
    executive_report = call("GET", "/coverage/api/executive-report?limit=900", token=tokens["admin"], expected=200)
    if not heatmap["body"].get("heatmap") or not matrix["body"].get("matrix") or not executive_report["body"].get("executive_report"):
        raise AssertionError("coverage intelligence endpoints returned incomplete data")
    checks.append({"name": "coverage_intelligence", "visibility_score": heatmap["body"].get("summary", {}).get("visibility_score"), "blindspots": len(blindspots["body"].get("blindspots", []))})

    chaos = call(
        "POST",
        "/chaos/api/inject",
        token=tokens["admin"],
        json_body={"scenario_id": "telemetry-drop-sim", "duration_seconds": 60},
        expected=202,
    )
    injection_id = chaos["body"].get("injection", {}).get("injection_id")
    revert = call("POST", "/chaos/api/revert", token=tokens["admin"], json_body={"injection_id": injection_id}, expected=200)
    if not injection_id or not revert["body"].get("reverted"):
        raise AssertionError("chaos simulation did not revert cleanly")
    checks.append({"name": "security_chaos_simulation", "injection_id": injection_id})

    view = call("GET", "/intelligence/api/views/executive", token=tokens["admin"], expected=200)
    executive = call("GET", "/intelligence/api/executive?limit=900", token=tokens["admin"], expected=200)
    summary = call("POST", "/intelligence/api/analysis/incident-summary", token=tokens["soc"], json_body={"limit": 900}, expected=200)
    reconstruction = call("POST", "/intelligence/api/time-travel/reconstruct", token=tokens["soc"], json_body={"limit": 900}, expected=202)
    if not view["body"].get("widgets") or not executive["body"].get("executive_dashboard"):
        raise AssertionError("intelligence dashboard views are incomplete")
    if summary["body"].get("summary", {}).get("offensive_automation") is not False:
        raise AssertionError("defensive analysis summary violated offensive automation guard")
    if not reconstruction["body"].get("reconstruction", {}).get("deterministic"):
        raise AssertionError("time-travel reconstruction did not preserve deterministic replay metadata")
    checks.append({"name": "intelligence_dashboard_and_replay", "snapshot_id": reconstruction["body"].get("reconstruction", {}).get("snapshot_id")})

    time.sleep(3)

    rules = call("GET", "/detections/api/rules", token=tokens["detect"], expected=200)
    observed_rules = {rule.get("id") for rule in rules["body"].get("rules", [])}
    missing_rules = sorted(required_rule_ids() - observed_rules)
    if missing_rules:
        raise AssertionError(f"Stage 6 detection rules missing from engine: {missing_rules}")
    checks.append({"name": "stage6_detection_rules_loaded", "stage6_rules": len(required_rule_ids())})

    alerts = call("GET", "/detections/api/alerts?limit=1000", token=tokens["soc"], expected=200)
    alert_rule_ids = {alert.get("rule_id") for alert in alerts["body"].get("alerts", [])}
    missing_alerts = sorted(required_rule_ids() - alert_rule_ids)
    if missing_alerts:
        raise AssertionError(f"missing expected Stage 6 alerts: {missing_alerts}")
    checks.append({"name": "stage6_detection_alerts_generated", "alerts": len(alerts["body"].get("alerts", []))})

    validation = call("POST", "/detections/api/validation/run", token=tokens["detect"], json_body={"stage": "stage6", "limit": 1000}, expected=200)
    coverage = validation["body"].get("validation", {}).get("coverage_percent", 0)
    if coverage < 90:
        raise AssertionError(f"Stage 6 detection validation coverage too low: {validation['body']}")
    checks.append({"name": "stage6_detection_validation", "coverage_percent": coverage})

    siem_status = call("GET", "/siem/api/pipeline/status?limit=1000", token=tokens["soc"], expected=200)
    wazuh = call("GET", "/siem/api/wazuh/alerts?limit=1000", token=tokens["soc"], expected=200)
    wazuh_rule_ids = {alert.get("rule", {}).get("id") for alert in wazuh["body"].get("alerts", [])}
    if siem_status["body"].get("detection_alerts", 0) < len(required_rule_ids()) or not required_rule_ids().issubset(wazuh_rule_ids):
        raise AssertionError("SIEM/Wazuh-compatible pipeline did not expose all Stage 6 alerts")
    checks.append({"name": "siem_stage6_alert_pipeline", "alerts": siem_status["body"].get("detection_alerts")})

    timeline = call("GET", "/correlation/api/timeline?limit=1000", token=tokens["soc"], expected=200)
    incidents = call("GET", "/correlation/api/attack-paths?limit=1000", token=tokens["soc"], expected=200)
    if not any(item.get("event_name", "").startswith("stage6.") or item.get("event_name", "").startswith("digital_twin.") for item in timeline["body"].get("timeline", [])):
        raise AssertionError("correlation timeline does not include Stage 6 events")
    if not any(str(rule_id).startswith("SHIELD-S6") for incident in incidents["body"].get("incidents", []) for rule_id in incident.get("rule_ids", [])):
        raise AssertionError("correlation incidents do not include Stage 6 rule IDs")
    checks.append({"name": "attack_correlation_stage6", "incidents": len(incidents["body"].get("incidents", []))})

    service_health = call("GET", "/observability/service-health", token=tokens["admin"], expected=200)
    if service_health["body"].get("healthy", 0) < 29:
        raise AssertionError(f"expected at least 29 healthy Stage 6 services, got {service_health['body']}")
    checks.append({"name": "observability_stage6_service_health", "healthy": service_health["body"].get("healthy")})

    log_summary = call("GET", "/logs/events/summary", token=tokens["admin"], expected=200)
    services_seen = set(log_summary["body"].get("services", {}).keys())
    expected_services = {"digital-twin", "attack-graph", "campaign-orchestrator", "threat-hunting", "coverage-intel", "chaos-sim", "intelligence-dashboard"}
    if not expected_services.issubset(services_seen):
        raise AssertionError(f"centralized logs missing Stage 6 services: {sorted(expected_services - services_seen)}")
    checks.append({"name": "centralized_stage6_logging", "stage6_services_seen": sorted(expected_services)})

    report = {
        "title": "Shield-PDP Stage 6 Enterprise Intelligence, Digital Twin, and Autonomous Simulation Validation",
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

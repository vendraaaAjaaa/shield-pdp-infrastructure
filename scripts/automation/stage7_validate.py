import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, parse, request

import yaml


BASE_URL = os.getenv("SHIELD_PDP_ENTERPRISE_URL", "http://localhost:3100").rstrip("/")
TIMEOUT = float(os.getenv("SHIELD_PDP_HTTP_TIMEOUT", "5"))
ROOT = Path(__file__).resolve().parents[2]


def call(method, path, token=None, data=None, json_body=None, expected=None, accept_json=True, extra_headers=None):
    request_id = f"stage7-{uuid.uuid4()}"
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
        "SHIELD-S7-K8S-GITOPS-001",
        "SHIELD-S7-TELEMETRY-001",
        "SHIELD-S7-RESILIENCE-001",
        "SHIELD-S7-MULTIENV-001",
        "SHIELD-S7-ZEROTRUST-001",
        "SHIELD-S7-GOVERNANCE-001",
        "SHIELD-S7-DELIVERY-001",
        "SHIELD-S7-REPLAY-001",
    }


def parse_yaml_file(path):
    with path.open("r", encoding="utf-8") as handle:
        return [doc for doc in yaml.safe_load_all(handle) if doc]


def validate_kubernetes_artifacts():
    base = ROOT / "kubernetes" / "base"
    required = {
        "namespace.yaml",
        "configmap-enterprise-core.yaml",
        "secret-template.yaml",
        "resourcequota.yaml",
        "enterprise-core-deployment.yaml",
        "service.yaml",
        "hpa.yaml",
        "networkpolicy.yaml",
        "ingress.yaml",
        "kustomization.yaml",
    }
    missing = sorted(name for name in required if not (base / name).exists())
    if missing:
        raise AssertionError(f"missing Kubernetes base manifests: {missing}")
    documents = []
    for file_name in sorted(required):
        documents.extend(parse_yaml_file(base / file_name))
    kinds = {doc.get("kind") for doc in documents}
    expected_kinds = {"Namespace", "ConfigMap", "Secret", "ResourceQuota", "Deployment", "Service", "HorizontalPodAutoscaler", "NetworkPolicy", "Ingress", "Kustomization"}
    if not expected_kinds.issubset(kinds):
        raise AssertionError(f"Kubernetes manifests missing kinds: {sorted(expected_kinds - kinds)}")
    deployments = [doc for doc in documents if doc.get("kind") == "Deployment"]
    if not deployments:
        raise AssertionError("no Kubernetes Deployment manifest found")
    container = deployments[0]["spec"]["template"]["spec"]["containers"][0]
    if "readinessProbe" not in container or "livenessProbe" not in container:
        raise AssertionError("deployment health probes are incomplete")
    overlays = [
        ROOT / "kubernetes" / "overlays" / "local" / "kustomization.yaml",
        ROOT / "kubernetes" / "overlays" / "distributed" / "kustomization.yaml",
    ]
    for overlay in overlays:
        docs = parse_yaml_file(overlay)
        if not docs or docs[0].get("kind") != "Kustomization":
            raise AssertionError(f"invalid kustomize overlay: {overlay}")
    return {"documents": len(documents), "kinds": sorted(kinds)}


def validate_helm_gitops_artifacts():
    chart = ROOT / "helm" / "shield-pdp"
    chart_meta = parse_yaml_file(chart / "Chart.yaml")[0]
    values = parse_yaml_file(chart / "values.yaml")[0]
    if chart_meta.get("apiVersion") != "v2" or chart_meta.get("version") != "0.7.0":
        raise AssertionError("Helm chart metadata is invalid")
    if values.get("config", {}).get("stage7TargetsEnabled") != "true":
        raise AssertionError("Helm values do not enable Stage 7 targets")
    templates = sorted((chart / "templates").glob("*.yaml"))
    if len(templates) < 6:
        raise AssertionError("Helm chart is missing expected templates")
    for template in templates:
        text = template.read_text(encoding="utf-8")
        if "kind:" not in text:
            raise AssertionError(f"Helm template lacks Kubernetes kind: {template}")
    argocd = sorted((ROOT / "gitops" / "argocd").glob("*.yaml"))
    if len(argocd) < 2:
        raise AssertionError("ArgoCD application manifests are missing")
    for manifest in argocd:
        doc = parse_yaml_file(manifest)[0]
        if doc.get("kind") != "Application" or doc.get("apiVersion") != "argoproj.io/v1alpha1":
            raise AssertionError(f"invalid ArgoCD manifest: {manifest}")
    return {"chart": chart_meta.get("name"), "templates": len(templates), "argocd_applications": len(argocd)}


def validate_observability_artifacts():
    directory = ROOT / "observability" / "stage7"
    required = {"otel-collector-config.yaml", "prometheus.yml", "grafana-datasources.yml", "loki-config.yml", "tempo-config.yml"}
    missing = sorted(name for name in required if not (directory / name).exists())
    if missing:
        raise AssertionError(f"missing observability configs: {missing}")
    parsed = {name: parse_yaml_file(directory / name)[0] for name in required}
    if "service" not in parsed["otel-collector-config.yaml"]:
        raise AssertionError("OpenTelemetry config lacks service pipelines")
    if "scrape_configs" not in parsed["prometheus.yml"]:
        raise AssertionError("Prometheus config lacks scrape_configs")
    if "datasources" not in parsed["grafana-datasources.yml"]:
        raise AssertionError("Grafana datasources config is incomplete")
    return {"configs": sorted(required)}


def main():
    checks = []

    gateway = call("GET", "/", expected=200)
    routes = set(gateway["body"].get("routes", []))
    expected_routes = {
        "/platform/kubernetes/",
        "/platform/gitops/",
        "/telemetry-fabric/",
        "/resilience/",
        "/environments/",
        "/zero-trust/",
        "/governance/",
        "/delivery-governance/",
        "/scale/",
    }
    missing_routes = sorted(expected_routes - routes)
    if missing_routes:
        raise AssertionError(f"gateway Stage 7 routes missing: {missing_routes}")
    checks.append({"name": "enterprise_gateway_stage7_routes", "routes": sorted(expected_routes)})

    checks.append({"name": "kubernetes_manifests_validate", **validate_kubernetes_artifacts()})
    checks.append({"name": "helm_gitops_artifacts_validate", **validate_helm_gitops_artifacts()})
    checks.append({"name": "observability_artifacts_validate", **validate_observability_artifacts()})

    tokens = {
        "soc": login("siti.soc", "SocPass123!"),
        "detect": login("nina.detect", "DetectPass123!"),
        "dev": login("dimas.dev", "DeveloperPass123!"),
        "admin": login("admin.enterprise", "AdminPass123!"),
    }
    checks.append({"name": "stage7_roles_login", "roles": ["platform_engineer", "resilience_engineer", "compliance_manager", "soc_analyst", "detection_engineer", "admin"]})

    k8s_validation = call("POST", "/platform/kubernetes/api/validate", token=tokens["admin"], json_body={}, expected=200)
    namespaces = call("GET", "/platform/kubernetes/api/namespaces", token=tokens["dev"], expected=200)
    autoscaling = call("GET", "/platform/kubernetes/api/autoscaling", token=tokens["dev"], expected=200)
    if k8s_validation["body"].get("validation", {}).get("status") != "passed" or len(namespaces["body"].get("namespaces", [])) < 6 or len(autoscaling["body"].get("autoscaling_policies", [])) < 3:
        raise AssertionError("Kubernetes orchestration workflow incomplete")
    checks.append({"name": "kubernetes_orchestration_workflow", "namespaces": len(namespaces["body"].get("namespaces", []))})

    rollout = call("POST", "/platform/gitops/api/rollouts/plan", token=tokens["admin"], json_body={"application": "shield-pdp-distributed-lab"}, expected=202)
    rollback = call("POST", "/platform/gitops/api/rollbacks/simulate", token=tokens["admin"], json_body={"rollout_id": rollout["body"].get("rollout", {}).get("rollout_id")}, expected=200)
    if not rollout["body"].get("rollout", {}).get("rollback_supported") or rollback["body"].get("rollback", {}).get("real_deployment") is not False:
        raise AssertionError("GitOps rollout or rollback simulation failed safety checks")
    checks.append({"name": "gitops_rollout_workflow", "rollout_id": rollout["body"].get("rollout", {}).get("rollout_id")})

    trace = call("POST", "/telemetry-fabric/api/traces/generate", token=tokens["soc"], json_body={"limit": 1000}, expected=202)
    service_map = call("GET", "/telemetry-fabric/api/service-map?limit=1000", token=tokens["soc"], expected=200)
    sla = call("GET", "/telemetry-fabric/api/sla?limit=1000", token=tokens["soc"], expected=200)
    if not trace["body"].get("trace", {}).get("replay_compatible") or sla["body"].get("sla", {}).get("telemetry_integrity") != "preserved":
        raise AssertionError("distributed telemetry trace or SLA validation failed")
    checks.append({"name": "distributed_telemetry_workflow", "trace_id": trace["body"].get("trace", {}).get("trace_id"), "services": len(service_map["body"].get("service_map", []))})

    failover = call("POST", "/resilience/api/failover/simulate", token=tokens["admin"], json_body={"plan_id": "telemetry-queue-failover"}, expected=202)
    recovery = call("POST", "/resilience/api/recovery/verify", token=tokens["admin"], json_body={}, expected=200)
    if failover["body"].get("failover", {}).get("detection_integrity") != "preserved" or recovery["body"].get("verification", {}).get("status") != "passed":
        raise AssertionError("resilience failover or recovery verification failed")
    checks.append({"name": "ha_resilience_workflow", "failover_id": failover["body"].get("failover", {}).get("failover_id")})

    topology = call("POST", "/environments/api/topologies/generate", token=tokens["soc"], json_body={"topology_id": "multi-region-enterprise"}, expected=202)
    isolation = call("GET", "/environments/api/tenant-isolation", token=tokens["soc"], expected=200)
    if topology["body"].get("graph", {}).get("summary", {}).get("nodes", 0) < 5 or not isolation["body"].get("cross_environment_telemetry"):
        raise AssertionError("multi-environment topology workflow failed")
    checks.append({"name": "multi_environment_topology", "nodes": topology["body"].get("graph", {}).get("summary", {}).get("nodes")})

    mesh = call("POST", "/zero-trust/api/policies/evaluate", token=tokens["detect"], json_body={"source": "vendor-support", "destination": "shield-enterprise-admin"}, expected=200)
    mtls = call("GET", "/zero-trust/api/mtls/status", token=tokens["detect"], expected=200)
    if mesh["body"].get("evaluation", {}).get("decision") != "deny" or mtls["body"].get("mtls", {}).get("mode") != "STRICT-simulation":
        raise AssertionError("zero-trust mesh evaluation failed")
    checks.append({"name": "zero_trust_mesh_workflow", "decision": mesh["body"].get("evaluation", {}).get("decision")})

    compliance = call("POST", "/governance/api/compliance/check", token=tokens["admin"], json_body={}, expected=200)
    rotation = call("POST", "/governance/api/secrets/rotate", token=tokens["admin"], json_body={"secret_ref": "service-account-lab"}, expected=202)
    integrity = call("GET", "/governance/api/integrity", token=tokens["admin"], expected=200)
    if compliance["body"].get("compliance", {}).get("score", 0) < 70 or rotation["body"].get("rotation", {}).get("new_secret_material_generated") is not False or integrity["body"].get("integrity", {}).get("telemetry_integrity") != "preserved":
        raise AssertionError("governance workflow failed")
    checks.append({"name": "governance_workflow", "score": compliance["body"].get("compliance", {}).get("score")})

    artifact = call("POST", "/delivery-governance/api/artifacts/verify", token=tokens["dev"], json_body={}, expected=200)
    depscan = call("POST", "/delivery-governance/api/dependency-scan", token=tokens["dev"], json_body={"repository": "customer-api"}, expected=200)
    approval = call("POST", "/delivery-governance/api/approvals/request", token=tokens["admin"], json_body={"environment": "distributed"}, expected=202)
    policy = call("POST", "/delivery-governance/api/policy/validate", token=tokens["admin"], json_body={}, expected=200)
    if artifact["body"].get("verification", {}).get("real_deployment") is not False or depscan["body"].get("scan", {}).get("real_package_download") is not False or policy["body"].get("validation", {}).get("status") != "passed":
        raise AssertionError("delivery governance workflow failed safety checks")
    checks.append({"name": "delivery_governance_workflow", "approval_id": approval["body"].get("approval", {}).get("approval_id")})

    executive = call("GET", "/scale/api/executive?limit=1000", token=tokens["admin"], expected=200)
    view = call("GET", "/scale/api/views/executive", token=tokens["admin"], expected=200)
    replay_analytics = call("GET", "/scale/api/replay/analytics?limit=1000", token=tokens["soc"], expected=200)
    replay_export = call("POST", "/scale/api/replay/export", token=tokens["soc"], json_body={"limit": 1000}, expected=202)
    if not view["body"].get("widgets") or executive["body"].get("executive_dashboard", {}).get("synthetic_only") is not True:
        raise AssertionError("scale dashboard executive workflow failed")
    if not replay_analytics["body"].get("replay_analytics", {}).get("deterministic") or not replay_export["body"].get("replay_export", {}).get("deterministic"):
        raise AssertionError("enterprise-scale replay integrity failed")
    checks.append({"name": "scale_dashboard_replay_workflow", "export_id": replay_export["body"].get("replay_export", {}).get("export_id")})

    time.sleep(3)

    rules = call("GET", "/detections/api/rules", token=tokens["detect"], expected=200)
    observed_rules = {rule.get("id") for rule in rules["body"].get("rules", [])}
    missing_rules = sorted(required_rule_ids() - observed_rules)
    if missing_rules:
        raise AssertionError(f"Stage 7 detection rules missing from engine: {missing_rules}")
    checks.append({"name": "stage7_detection_rules_loaded", "stage7_rules": len(required_rule_ids())})

    alerts = call("GET", "/detections/api/alerts?limit=1000", token=tokens["soc"], expected=200)
    alert_rule_ids = {alert.get("rule_id") for alert in alerts["body"].get("alerts", [])}
    missing_alerts = sorted(required_rule_ids() - alert_rule_ids)
    if missing_alerts:
        raise AssertionError(f"missing expected Stage 7 alerts: {missing_alerts}")
    checks.append({"name": "stage7_detection_alerts_generated", "alerts": len(alerts["body"].get("alerts", []))})

    validation = call("POST", "/detections/api/validation/run", token=tokens["detect"], json_body={"stage": "stage7", "limit": 1000}, expected=200)
    coverage = validation["body"].get("validation", {}).get("coverage_percent", 0)
    if coverage < 90:
        raise AssertionError(f"Stage 7 detection validation coverage too low: {validation['body']}")
    checks.append({"name": "stage7_detection_validation", "coverage_percent": coverage})

    siem_status = call("GET", "/siem/api/pipeline/status?limit=1000", token=tokens["soc"], expected=200)
    wazuh = call("GET", "/siem/api/wazuh/alerts?limit=1000", token=tokens["soc"], expected=200)
    wazuh_rule_ids = {alert.get("rule", {}).get("id") for alert in wazuh["body"].get("alerts", [])}
    if siem_status["body"].get("detection_alerts", 0) < len(required_rule_ids()) or not required_rule_ids().issubset(wazuh_rule_ids):
        raise AssertionError("SIEM/Wazuh-compatible pipeline did not expose all Stage 7 alerts")
    checks.append({"name": "siem_stage7_alert_pipeline", "alerts": siem_status["body"].get("detection_alerts")})

    timeline = call("GET", "/correlation/api/timeline?limit=1000", token=tokens["soc"], expected=200)
    incidents = call("GET", "/correlation/api/attack-paths?limit=1000", token=tokens["soc"], expected=200)
    if not any(item.get("event_name", "").startswith("stage7.") for item in timeline["body"].get("timeline", [])):
        raise AssertionError("correlation timeline does not include Stage 7 events")
    if not any(str(rule_id).startswith("SHIELD-S7") for incident in incidents["body"].get("incidents", []) for rule_id in incident.get("rule_ids", [])):
        raise AssertionError("correlation incidents do not include Stage 7 rule IDs")
    checks.append({"name": "attack_correlation_stage7", "incidents": len(incidents["body"].get("incidents", []))})

    service_health = call("GET", "/observability/service-health", token=tokens["admin"], expected=200)
    if service_health["body"].get("healthy", 0) < 38:
        raise AssertionError(f"expected at least 38 healthy Stage 7 services, got {service_health['body']}")
    checks.append({"name": "observability_stage7_service_health", "healthy": service_health["body"].get("healthy")})

    log_summary = call("GET", "/logs/events/summary", token=tokens["admin"], expected=200)
    services_seen = set(log_summary["body"].get("services", {}).keys())
    expected_services = {
        "kubernetes-orchestrator",
        "gitops-controller",
        "telemetry-fabric",
        "resilience-hub",
        "environment-manager",
        "zero-trust-mesh",
        "governance-engine",
        "delivery-governance",
        "scale-dashboard",
    }
    if not expected_services.issubset(services_seen):
        raise AssertionError(f"centralized logs missing Stage 7 services: {sorted(expected_services - services_seen)}")
    checks.append({"name": "centralized_stage7_logging", "stage7_services_seen": sorted(expected_services)})

    report = {
        "title": "Shield-PDP Stage 7 Productionization, Distributed Infrastructure, and Enterprise Scale Validation",
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

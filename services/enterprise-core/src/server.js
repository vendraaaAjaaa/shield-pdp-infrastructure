const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

const SERVICE_MODE = process.env.SERVICE_MODE || "employee";
const SERVICE_NAME = process.env.SERVICE_NAME || SERVICE_MODE;
const PORT = Number(process.env.PORT || 8080);
const STARTED_AT = Date.now();

const ISSUER = process.env.ENTERPRISE_JWT_ISSUER || "shield-pdp-enterprise";
const AUDIENCE = process.env.ENTERPRISE_JWT_AUDIENCE || "shield-pdp-internal";
const JWT_SECRET = process.env.ENTERPRISE_JWT_SECRET || "shield-pdp-enterprise-lab-secret-change-before-production";
const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || "http://auth-service:8080").replace(/\/$/, "");
const LOG_COLLECTOR_URL = (process.env.LOG_COLLECTOR_URL || "").replace(/\/$/, "");
const SIEM_BRIDGE_URL = (process.env.SIEM_BRIDGE_URL || "http://siem-bridge:8080").replace(/\/$/, "");
const DETECTION_ENGINE_URL = (process.env.DETECTION_ENGINE_URL || "http://detection-engine:8080").replace(/\/$/, "");
const CORRELATION_ENGINE_URL = (process.env.CORRELATION_ENGINE_URL || "http://correlation-engine:8080").replace(/\/$/, "");
const ADVERSARY_CONTROL_URL = (process.env.ADVERSARY_CONTROL_URL || "http://adversary-control:8080").replace(/\/$/, "");
const BEACON_SIM_URL = (process.env.BEACON_SIM_URL || "http://beacon-sim:8080").replace(/\/$/, "");
const REDIRECTOR_SIM_URL = (process.env.REDIRECTOR_SIM_URL || "http://redirector-sim:8080").replace(/\/$/, "");
const PIVOT_SIM_URL = (process.env.PIVOT_SIM_URL || "http://pivot-sim:8080").replace(/\/$/, "");
const PERSISTENCE_SIM_URL = (process.env.PERSISTENCE_SIM_URL || "http://persistence-sim:8080").replace(/\/$/, "");
const DIGITAL_TWIN_URL = (process.env.DIGITAL_TWIN_URL || "http://digital-twin:8080").replace(/\/$/, "");
const ATTACK_GRAPH_URL = (process.env.ATTACK_GRAPH_URL || "http://attack-graph:8080").replace(/\/$/, "");
const CAMPAIGN_ORCHESTRATOR_URL = (process.env.CAMPAIGN_ORCHESTRATOR_URL || "http://campaign-orchestrator:8080").replace(/\/$/, "");
const THREAT_HUNTING_URL = (process.env.THREAT_HUNTING_URL || "http://threat-hunting:8080").replace(/\/$/, "");
const COVERAGE_INTEL_URL = (process.env.COVERAGE_INTEL_URL || "http://coverage-intel:8080").replace(/\/$/, "");
const CHAOS_SIM_URL = (process.env.CHAOS_SIM_URL || "http://chaos-sim:8080").replace(/\/$/, "");
const INTELLIGENCE_DASHBOARD_URL = (process.env.INTELLIGENCE_DASHBOARD_URL || "http://intelligence-dashboard:8080").replace(/\/$/, "");
const KUBERNETES_ORCHESTRATOR_URL = (process.env.KUBERNETES_ORCHESTRATOR_URL || "http://kubernetes-orchestrator:8080").replace(/\/$/, "");
const GITOPS_CONTROLLER_URL = (process.env.GITOPS_CONTROLLER_URL || "http://gitops-controller:8080").replace(/\/$/, "");
const TELEMETRY_FABRIC_URL = (process.env.TELEMETRY_FABRIC_URL || "http://telemetry-fabric:8080").replace(/\/$/, "");
const RESILIENCE_HUB_URL = (process.env.RESILIENCE_HUB_URL || "http://resilience-hub:8080").replace(/\/$/, "");
const ENVIRONMENT_MANAGER_URL = (process.env.ENVIRONMENT_MANAGER_URL || "http://environment-manager:8080").replace(/\/$/, "");
const ZERO_TRUST_MESH_URL = (process.env.ZERO_TRUST_MESH_URL || "http://zero-trust-mesh:8080").replace(/\/$/, "");
const GOVERNANCE_ENGINE_URL = (process.env.GOVERNANCE_ENGINE_URL || "http://governance-engine:8080").replace(/\/$/, "");
const DELIVERY_GOVERNANCE_URL = (process.env.DELIVERY_GOVERNANCE_URL || "http://delivery-governance:8080").replace(/\/$/, "");
const SCALE_DASHBOARD_URL = (process.env.SCALE_DASHBOARD_URL || "http://scale-dashboard:8080").replace(/\/$/, "");
const SERVICE_ACCOUNT_ID = process.env.SERVICE_ACCOUNT_ID || SERVICE_NAME;
const SERVICE_ACCOUNT_SECRET = process.env.SERVICE_ACCOUNT_SECRET || "shield-service-account-lab-secret";
const LOG_INGEST_TOKEN = process.env.LOG_INGEST_TOKEN || "shield-log-ingest-lab-token";
const EVENT_STORE_PATH = process.env.EVENT_STORE_PATH || "/var/lib/shield-pdp/events.jsonl";
const PIPELINE_TOKEN = process.env.PIPELINE_TOKEN || "lab-pipeline-token-stage3";
const STALE_TOKEN_GRACE_SECONDS = parseDurationSeconds(process.env.STALE_TOKEN_GRACE_SECONDS, 3600);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: false }));

const counters = {
  requestsTotal: 0,
  errorsTotal: 0,
  authFailuresTotal: 0,
  telemetrySentTotal: 0,
  telemetryFailedTotal: 0,
};

const memoryEvents = [];
const MAX_MEMORY_EVENTS = Number(process.env.MAX_MEMORY_EVENTS || 1000);
let cachedServiceToken = null;
let cachedServiceTokenExpiresAt = 0;

const userPasswordDefaults = {
  "alice.employee": process.env.ALICE_EMPLOYEE_PASSWORD || "EmployeePass123!",
  "dimas.dev": process.env.DIMAS_DEV_PASSWORD || "DeveloperPass123!",
  "rani.hr": process.env.RANI_HR_PASSWORD || "HrPass123!",
  "budi.finance": process.env.BUDI_FINANCE_PASSWORD || "FinancePass123!",
  "siti.soc": process.env.SITI_SOC_PASSWORD || "SocPass123!",
  "nina.detect": process.env.NINA_DETECT_PASSWORD || "DetectPass123!",
  "reza.red": process.env.REZA_RED_PASSWORD || "RedTeamPass123!",
  "admin.enterprise": process.env.ENTERPRISE_ADMIN_PASSWORD || "AdminPass123!",
};

const directoryUsers = [
  {
    id: "u-1001",
    username: "alice.employee",
    display_name: "Alice Santoso",
    department: "Operations",
    title: "Customer Operations Specialist",
    roles: ["employee"],
    scopes: ["portal:employee:read"],
    manager: "rani.hr",
  },
  {
    id: "u-1002",
    username: "dimas.dev",
    display_name: "Dimas Pratama",
    department: "Engineering",
    title: "Platform Developer",
    roles: ["employee", "developer", "platform_engineer"],
    scopes: ["portal:employee:read", "portal:developer:read", "platform:read", "telemetry:read"],
    manager: "admin.enterprise",
  },
  {
    id: "u-1003",
    username: "rani.hr",
    display_name: "Rani Wijaya",
    department: "Human Resources",
    title: "HR Business Partner",
    roles: ["employee", "hr"],
    scopes: ["portal:employee:read", "portal:hr:read"],
    manager: "admin.enterprise",
  },
  {
    id: "u-1004",
    username: "budi.finance",
    display_name: "Budi Hartono",
    department: "Finance",
    title: "Finance Analyst",
    roles: ["employee", "finance"],
    scopes: ["portal:employee:read", "portal:finance:read"],
    manager: "admin.enterprise",
  },
  {
    id: "u-1005",
    username: "siti.soc",
    display_name: "Siti Rahma",
    department: "Security Operations",
    title: "SOC Analyst",
    roles: ["employee", "soc_analyst", "threat_hunter", "incident_responder"],
    scopes: ["portal:employee:read", "observability:read", "logs:read", "operations:read", "hunting:read", "intelligence:read", "graph:read", "telemetry:read", "platform:read"],
    manager: "admin.enterprise",
  },
  {
    id: "u-9001",
    username: "admin.enterprise",
    display_name: "Enterprise Administrator",
    department: "Information Security",
    title: "Security Platform Administrator",
    roles: ["employee", "admin", "soc_analyst", "threat_hunter", "incident_responder", "platform_engineer", "compliance_manager", "resilience_engineer"],
    scopes: [
      "portal:employee:read",
      "portal:developer:read",
      "portal:hr:read",
      "portal:finance:read",
      "admin:read",
      "observability:read",
      "logs:read",
      "operations:read",
      "operations:simulate",
      "attack:replay",
      "hunting:read",
      "intelligence:read",
      "graph:read",
      "coverage:read",
      "chaos:simulate",
      "campaign:orchestrate",
      "platform:read",
      "platform:operate",
      "telemetry:read",
      "mesh:read",
      "governance:read",
      "governance:write",
      "delivery:govern",
    ],
    manager: null,
  },
  {
    id: "u-1006",
    username: "nina.detect",
    display_name: "Nina Kartika",
    department: "Security Engineering",
    title: "Detection Engineer",
    roles: ["employee", "detection_engineer", "soc_analyst", "threat_hunter", "platform_engineer"],
    scopes: ["portal:employee:read", "observability:read", "logs:read", "detection:read", "detection:write", "correlation:read", "operations:read", "hunting:read", "intelligence:read", "coverage:read", "graph:read", "telemetry:read", "platform:read", "governance:read"],
    manager: "admin.enterprise",
  },
  {
    id: "u-1007",
    username: "reza.red",
    display_name: "Reza Mahendra",
    department: "Security Research",
    title: "Red Team Operator",
    roles: ["employee", "red_team_operator"],
    scopes: ["portal:employee:read", "detection:read", "correlation:read", "attack:replay", "operations:read", "operations:simulate", "beacon:simulate", "campaign:orchestrate", "graph:read"],
    manager: "admin.enterprise",
  },
];

const serviceAccounts = [
  {
    client_id: "enterprise-gateway",
    name: "Enterprise Gateway",
    roles: ["service_gateway"],
    scopes: ["auth:authorize", "telemetry:write"],
  },
  {
    client_id: "employee-portal",
    name: "Employee Portal",
    roles: ["service_application"],
    scopes: ["identity:introspect", "telemetry:write"],
  },
  {
    client_id: "hr-portal",
    name: "HR Portal",
    roles: ["service_application", "service_privileged"],
    scopes: ["identity:introspect", "telemetry:write"],
  },
  {
    client_id: "finance-portal",
    name: "Finance Portal",
    roles: ["service_application", "service_privileged"],
    scopes: ["identity:introspect", "telemetry:write"],
  },
  {
    client_id: "internal-admin-dashboard",
    name: "Internal Admin Dashboard",
    roles: ["service_admin"],
    scopes: ["identity:introspect", "telemetry:write", "observability:read"],
  },
  {
    client_id: "developer-dashboard",
    name: "Developer Dashboard",
    roles: ["service_devops"],
    scopes: ["identity:introspect", "telemetry:write"],
  },
  {
    client_id: "log-collector",
    name: "Central Log Collector",
    roles: ["service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write"],
  },
  {
    client_id: "observability-api",
    name: "Observability API",
    roles: ["service_observability"],
    scopes: ["identity:introspect", "observability:read", "telemetry:write"],
  },
  {
    client_id: "auth-service",
    name: "Enterprise Auth Service",
    roles: ["service_identity"],
    scopes: ["identity:introspect", "telemetry:write"],
  },
  {
    client_id: "internal-api",
    name: "Internal API Mesh",
    roles: ["service_application", "service_privileged"],
    scopes: ["identity:introspect", "telemetry:write", "internal:read"],
  },
  {
    client_id: "service-discovery",
    name: "Internal Service Discovery",
    roles: ["service_inventory"],
    scopes: ["identity:introspect", "telemetry:write", "discovery:read"],
  },
  {
    client_id: "git-sim",
    name: "Git Service Simulation",
    roles: ["service_devops"],
    scopes: ["identity:introspect", "telemetry:write", "git:read"],
  },
  {
    client_id: "ci-sim",
    name: "CI Runner Simulation",
    roles: ["service_devops", "service_privileged"],
    scopes: ["identity:introspect", "telemetry:write", "ci:run"],
  },
  {
    client_id: "artifact-store",
    name: "Artifact Store Simulation",
    roles: ["service_devops"],
    scopes: ["identity:introspect", "telemetry:write", "artifacts:read"],
  },
  {
    client_id: "secrets-broker",
    name: "Secrets Broker Simulation",
    roles: ["service_identity", "service_privileged"],
    scopes: ["identity:introspect", "telemetry:write", "secrets:read"],
  },
  {
    client_id: "siem-bridge",
    name: "SIEM Integration Bridge",
    roles: ["service_observability", "service_siem"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "siem:write"],
  },
  {
    client_id: "detection-engine",
    name: "Detection Engineering Engine",
    roles: ["service_observability", "service_detection"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "detection:read", "detection:write"],
  },
  {
    client_id: "correlation-engine",
    name: "Attack Correlation Engine",
    roles: ["service_observability", "service_correlation"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "detection:read", "correlation:read"],
  },
  {
    client_id: "soc-dashboard",
    name: "Purple Team SOC Dashboard",
    roles: ["service_observability", "service_soc"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "detection:read", "correlation:read"],
  },
  {
    client_id: "adversary-control",
    name: "Controlled Adversary Operations Console",
    roles: ["service_redteam", "service_operations", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "operations:read", "operations:simulate", "attack:replay"],
  },
  {
    client_id: "beacon-sim",
    name: "Safe Beacon Simulation Service",
    roles: ["service_redteam", "service_operations"],
    scopes: ["identity:introspect", "telemetry:write", "operations:read", "beacon:simulate"],
  },
  {
    client_id: "redirector-sim",
    name: "Redirector and Traffic Shaping Simulation Service",
    roles: ["service_redteam", "service_operations"],
    scopes: ["identity:introspect", "telemetry:write", "operations:read"],
  },
  {
    client_id: "pivot-sim",
    name: "Lateral Movement Simulation Service",
    roles: ["service_redteam", "service_operations", "service_privileged"],
    scopes: ["identity:introspect", "telemetry:write", "operations:read"],
  },
  {
    client_id: "persistence-sim",
    name: "Reversible Persistence Simulation Service",
    roles: ["service_redteam", "service_operations"],
    scopes: ["identity:introspect", "telemetry:write", "operations:read"],
  },
  {
    client_id: "digital-twin",
    name: "Enterprise Digital Twin Activity Service",
    roles: ["service_intelligence", "service_digital_twin", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "intelligence:read"],
  },
  {
    client_id: "attack-graph",
    name: "Dynamic Attack Graph Engine",
    roles: ["service_intelligence", "service_graph", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "graph:read", "intelligence:read"],
  },
  {
    client_id: "campaign-orchestrator",
    name: "Autonomous Campaign Orchestrator Simulation",
    roles: ["service_intelligence", "service_orchestrator", "service_redteam", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "operations:simulate", "campaign:orchestrate", "attack:replay"],
  },
  {
    client_id: "threat-hunting",
    name: "Threat Hunting Platform",
    roles: ["service_intelligence", "service_hunting", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "hunting:read", "correlation:read"],
  },
  {
    client_id: "coverage-intel",
    name: "Detection Coverage Intelligence Service",
    roles: ["service_intelligence", "service_coverage", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "coverage:read", "detection:read"],
  },
  {
    client_id: "chaos-sim",
    name: "Security Chaos Engineering Simulation Service",
    roles: ["service_intelligence", "service_chaos", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "chaos:simulate"],
  },
  {
    client_id: "intelligence-dashboard",
    name: "Enterprise Intelligence Dashboard",
    roles: ["service_intelligence", "service_observability", "service_soc"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "intelligence:read", "graph:read", "coverage:read", "hunting:read"],
  },
  {
    client_id: "kubernetes-orchestrator",
    name: "Kubernetes Orchestration Simulation",
    roles: ["service_platform", "service_kubernetes", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "platform:read", "platform:operate"],
  },
  {
    client_id: "gitops-controller",
    name: "GitOps and Helm Controller Simulation",
    roles: ["service_platform", "service_gitops", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "platform:read", "platform:operate", "delivery:govern"],
  },
  {
    client_id: "telemetry-fabric",
    name: "Distributed Telemetry Fabric",
    roles: ["service_platform", "service_telemetry_fabric", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "telemetry:read", "observability:read"],
  },
  {
    client_id: "resilience-hub",
    name: "High Availability and Resilience Hub",
    roles: ["service_platform", "service_resilience", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "platform:read", "platform:operate"],
  },
  {
    client_id: "environment-manager",
    name: "Multi-Environment Enterprise Manager",
    roles: ["service_platform", "service_environment", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "platform:read", "graph:read"],
  },
  {
    client_id: "zero-trust-mesh",
    name: "Zero Trust Service Mesh Simulation",
    roles: ["service_platform", "service_mesh", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "mesh:read", "platform:read"],
  },
  {
    client_id: "governance-engine",
    name: "Infrastructure Governance Engine",
    roles: ["service_platform", "service_governance", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "governance:read", "governance:write"],
  },
  {
    client_id: "delivery-governance",
    name: "Production CI/CD Governance Service",
    roles: ["service_platform", "service_delivery_governance", "service_devops", "service_observability"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "delivery:govern", "ci:run", "artifacts:read"],
  },
  {
    client_id: "scale-dashboard",
    name: "Enterprise Scale Operations Dashboard",
    roles: ["service_platform", "service_observability", "service_soc"],
    scopes: ["identity:introspect", "logs:read", "telemetry:write", "platform:read", "telemetry:read", "governance:read", "graph:read"],
  },
];

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function parseDurationSeconds(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function signJwtForAudience(payload, audience = AUDIENCE, expiresInSeconds = 1800) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    iss: ISSUER,
    aud: audience,
    iat: now,
    nbf: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomUUID(),
    ...payload,
  };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedBody = base64Url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

function signJwt(payload, expiresInSeconds = 1800) {
  return signJwtForAudience(payload, AUDIENCE, expiresInSeconds);
}

function verifyJwtWithOptions(token, options = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed token");
  }
  const [encodedHeader, encodedBody, signature] = parts;
  const expected = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new Error("Invalid token signature");
  }
  const payload = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== ISSUER) {
    throw new Error("Invalid token issuer");
  }
  if (!options.ignoreAudience && payload.aud !== AUDIENCE) {
    throw new Error("Invalid token audience");
  }
  if (payload.nbf && payload.nbf > now) {
    throw new Error("Token not active");
  }
  if (payload.exp && payload.exp <= now) {
    const graceSeconds = Number(options.allowExpiredGraceSeconds || 0);
    if (!graceSeconds || payload.exp + graceSeconds <= now) {
      throw new Error("Token expired");
    }
  }
  return payload;
}

function verifyJwt(token) {
  return verifyJwtWithOptions(token);
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function log(level, message, extra = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    mode: SERVICE_MODE,
    message,
    ...extra,
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    department: user.department,
    title: user.title,
    roles: user.roles,
    scopes: user.scopes,
    manager: user.manager,
  };
}

function findUser(username) {
  const normalized = String(username || "").trim().toLowerCase();
  return directoryUsers.find((user) => user.username === normalized);
}

function authenticateUser(username, password) {
  const user = findUser(username);
  if (!user) {
    return null;
  }
  const expected = userPasswordDefaults[user.username];
  if (!constantTimeEqual(password, expected)) {
    return null;
  }
  return user;
}

function findServiceAccount(clientId) {
  return serviceAccounts.find((account) => account.client_id === clientId);
}

function authenticateServiceAccount(clientId, secret) {
  const account = findServiceAccount(clientId);
  if (!account || !constantTimeEqual(secret, SERVICE_ACCOUNT_SECRET)) {
    return null;
  }
  return account;
}

function tokenFromRequest(req) {
  const value = req.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function rolesFromHeader(req) {
  return String(req.get("x-authenticated-roles") || "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

function scopesFromHeader(req) {
  return String(req.get("x-authenticated-scopes") || "")
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function hasAnyRole(principal, allowedRoles) {
  if (!allowedRoles.length) {
    return true;
  }
  const principalRoles = principal.roles || [];
  return allowedRoles.some((role) => principalRoles.includes(role));
}

async function introspectRemote(token) {
  const response = await fetch(`${AUTH_SERVICE_URL}/oauth/introspect`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": crypto.randomUUID() },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  return body.active ? body : null;
}

async function principalFromRequest(req) {
  const headerUser = req.get("x-authenticated-user");
  if (headerUser) {
    return {
      sub: headerUser,
      username: headerUser,
      roles: rolesFromHeader(req),
      scopes: scopesFromHeader(req),
      source: "gateway",
    };
  }

  const token = tokenFromRequest(req);
  if (!token) {
    return null;
  }

  try {
    return verifyJwt(token);
  } catch (error) {
    if (AUTH_SERVICE_URL) {
      return introspectRemote(token);
    }
    return null;
  }
}

function requireRoles(allowedRoles) {
  return async (req, res, next) => {
    const principal = await principalFromRequest(req);
    if (!principal) {
      counters.authFailuresTotal += 1;
      return res.status(401).json({ error: "authentication_required", request_id: req.requestId });
    }
    if (!hasAnyRole(principal, allowedRoles)) {
      counters.authFailuresTotal += 1;
      return res.status(403).json({ error: "insufficient_role", request_id: req.requestId });
    }
    req.principal = principal;
    return next();
  };
}

function createAccessTokenForUser(user) {
  const expiresIn = parseDurationSeconds(process.env.USER_TOKEN_TTL_SECONDS, 1800);
  const token = signJwt(
    {
      sub: user.username,
      user_id: user.id,
      display_name: user.display_name,
      roles: user.roles,
      scope: user.scopes.join(" "),
      type: "access",
      service_account: false,
    },
    expiresIn,
  );
  return { token, expiresIn };
}

function createAccessTokenForService(account) {
  const expiresIn = parseDurationSeconds(process.env.SERVICE_TOKEN_TTL_SECONDS, 900);
  const token = signJwt(
    {
      sub: account.client_id,
      client_id: account.client_id,
      display_name: account.name,
      roles: account.roles,
      scope: account.scopes.join(" "),
      type: "service",
      service_account: true,
    },
    expiresIn,
  );
  return { token, expiresIn };
}

async function getServiceToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedServiceToken && cachedServiceTokenExpiresAt - 30 > now) {
    return cachedServiceToken;
  }

  if (SERVICE_MODE === "auth") {
    const account = findServiceAccount(SERVICE_ACCOUNT_ID) || findServiceAccount("auth-service");
    const issued = createAccessTokenForService(account);
    cachedServiceToken = issued.token;
    cachedServiceTokenExpiresAt = now + issued.expiresIn;
    return cachedServiceToken;
  }

  const response = await fetch(`${AUTH_SERVICE_URL}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": crypto.randomUUID() },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: SERVICE_ACCOUNT_ID,
      client_secret: SERVICE_ACCOUNT_SECRET,
    }),
  });
  if (!response.ok) {
    throw new Error(`service token request failed: HTTP ${response.status}`);
  }
  const body = await response.json();
  cachedServiceToken = body.access_token;
  cachedServiceTokenExpiresAt = now + Number(body.expires_in || 300);
  return cachedServiceToken;
}

async function emitTelemetry(event) {
  if (!LOG_COLLECTOR_URL || SERVICE_MODE === "log") {
    return;
  }
  const enriched = {
    event_schema: "shield.telemetry.v1",
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    mode: SERVICE_MODE,
    ...event,
  };
  try {
    const token = await getServiceToken();
    const response = await fetch(`${LOG_COLLECTOR_URL}/ingest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-request-id": enriched.request_id || crypto.randomUUID(),
      },
      body: JSON.stringify(enriched),
    });
    if (!response.ok) {
      throw new Error(`telemetry ingest failed: HTTP ${response.status}`);
    }
    counters.telemetrySentTotal += 1;
  } catch (error) {
    counters.telemetryFailedTotal += 1;
    log("WARN", "Telemetry delivery failed.", { event: "telemetry.delivery_failed", error: error.message });
  }
}

app.use((req, res, next) => {
  counters.requestsTotal += 1;
  const requestId = req.get("x-request-id") || crypto.randomUUID();
  req.requestId = requestId;
  res.set("x-request-id", requestId);
  res.set("x-content-type-options", "nosniff");
  res.set("referrer-policy", "no-referrer");

  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    if (res.statusCode >= 500) {
      counters.errorsTotal += 1;
    }
    const event = {
      event: "http.request",
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      principal: req.get("x-authenticated-user") || undefined,
    };
    log("INFO", "Request completed.", event);
    emitTelemetry(event);
  });
  next();
});

function healthPayload() {
  return {
    service: SERVICE_NAME,
    mode: SERVICE_MODE,
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round((Date.now() - STARTED_AT) / 1000),
  };
}

function readinessPayload(extra = {}) {
  return {
    ...healthPayload(),
    readiness: "ready",
    issuer: ISSUER,
    audience: AUDIENCE,
    ...extra,
  };
}

app.get("/health", (req, res) => res.json(healthPayload()));

app.get("/ready", (req, res) => {
  if (SERVICE_MODE === "auth") {
    return res.json(readinessPayload({ users: directoryUsers.length, service_accounts: serviceAccounts.length }));
  }
  if (SERVICE_MODE === "log") {
    return res.json(readinessPayload({ buffered_events: memoryEvents.length, event_store: EVENT_STORE_PATH }));
  }
  if (SERVICE_MODE === "observability") {
    return res.json(readinessPayload({ monitored_services: serviceTargets().length }));
  }
  return res.json(readinessPayload({ auth_service_url: AUTH_SERVICE_URL, log_collector_url: LOG_COLLECTOR_URL || null }));
});

app.get("/metrics", (req, res) => {
  const lines = [
    "# HELP shield_enterprise_requests_total Total HTTP requests observed by this service.",
    "# TYPE shield_enterprise_requests_total counter",
    `shield_enterprise_requests_total{service="${SERVICE_NAME}",mode="${SERVICE_MODE}"} ${counters.requestsTotal}`,
    "# HELP shield_enterprise_errors_total Total HTTP 5xx responses observed by this service.",
    "# TYPE shield_enterprise_errors_total counter",
    `shield_enterprise_errors_total{service="${SERVICE_NAME}",mode="${SERVICE_MODE}"} ${counters.errorsTotal}`,
    "# HELP shield_enterprise_auth_failures_total Total authentication or authorization failures.",
    "# TYPE shield_enterprise_auth_failures_total counter",
    `shield_enterprise_auth_failures_total{service="${SERVICE_NAME}",mode="${SERVICE_MODE}"} ${counters.authFailuresTotal}`,
    "# HELP shield_enterprise_telemetry_sent_total Total telemetry events delivered by this service.",
    "# TYPE shield_enterprise_telemetry_sent_total counter",
    `shield_enterprise_telemetry_sent_total{service="${SERVICE_NAME}",mode="${SERVICE_MODE}"} ${counters.telemetrySentTotal}`,
    "# HELP shield_enterprise_telemetry_failed_total Total telemetry delivery failures.",
    "# TYPE shield_enterprise_telemetry_failed_total counter",
    `shield_enterprise_telemetry_failed_total{service="${SERVICE_NAME}",mode="${SERVICE_MODE}"} ${counters.telemetryFailedTotal}`,
  ];
  res.type("text/plain").send(`${lines.join("\n")}\n`);
});

function registerAuthRoutes() {
  app.get("/", (req, res) => {
    res.json({
      service: SERVICE_NAME,
      issuer: ISSUER,
      endpoints: ["/oauth/token", "/oauth/introspect", "/oauth/userinfo", "/gateway/authorize", "/directory/users"],
    });
  });

  app.get("/.well-known/oauth-authorization-server", (req, res) => {
    res.json({
      issuer: ISSUER,
      token_endpoint: "/oauth/token",
      introspection_endpoint: "/oauth/introspect",
      userinfo_endpoint: "/oauth/userinfo",
      grant_types_supported: ["password", "client_credentials"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      scopes_supported: [
        "portal:employee:read",
        "portal:developer:read",
        "portal:hr:read",
        "portal:finance:read",
        "admin:read",
        "observability:read",
        "logs:read",
        "telemetry:write",
        "internal:read",
        "discovery:read",
        "git:read",
        "ci:run",
        "artifacts:read",
        "secrets:read",
        "siem:write",
        "detection:read",
        "detection:write",
        "correlation:read",
        "attack:replay",
        "operations:read",
        "operations:simulate",
        "beacon:simulate",
        "hunting:read",
        "intelligence:read",
        "graph:read",
        "coverage:read",
        "chaos:simulate",
        "campaign:orchestrate",
        "platform:read",
        "platform:operate",
        "telemetry:read",
        "mesh:read",
        "governance:read",
        "governance:write",
        "delivery:govern",
      ],
    });
  });

  app.post("/oauth/token", (req, res) => {
    const grantType = req.body.grant_type || (req.body.username ? "password" : "client_credentials");
    if (grantType === "password") {
      const user = authenticateUser(req.body.username, req.body.password);
      if (!user) {
        counters.authFailuresTotal += 1;
        return res.status(401).json({ error: "invalid_grant", request_id: req.requestId });
      }
      const issued = createAccessTokenForUser(user);
      log("INFO", "Issued user token.", {
        event: "identity.token_issued",
        request_id: req.requestId,
        username: user.username,
        roles: user.roles,
      });
      return res.json({
        access_token: issued.token,
        token_type: "bearer",
        expires_in: issued.expiresIn,
        scope: user.scopes.join(" "),
        user: publicUser(user),
      });
    }

    if (grantType === "client_credentials") {
      const account = authenticateServiceAccount(req.body.client_id, req.body.client_secret);
      if (!account) {
        counters.authFailuresTotal += 1;
        return res.status(401).json({ error: "invalid_client", request_id: req.requestId });
      }
      const issued = createAccessTokenForService(account);
      log("INFO", "Issued service token.", {
        event: "identity.service_token_issued",
        request_id: req.requestId,
        client_id: account.client_id,
        scopes: account.scopes,
      });
      return res.json({
        access_token: issued.token,
        token_type: "bearer",
        expires_in: issued.expiresIn,
        scope: account.scopes.join(" "),
        service_account: { client_id: account.client_id, name: account.name, roles: account.roles },
      });
    }

    return res.status(400).json({ error: "unsupported_grant_type", request_id: req.requestId });
  });

  app.post("/oauth/introspect", (req, res) => {
    const token = req.body.token || tokenFromRequest(req);
    try {
      const claims = verifyJwt(token);
      return res.json({
        active: true,
        ...claims,
      });
    } catch (error) {
      counters.authFailuresTotal += 1;
      return res.json({ active: false });
    }
  });

  app.get("/oauth/userinfo", requireRoles([]), (req, res) => {
    const user = findUser(req.principal.sub);
    if (!user) {
      return res.json({
        sub: req.principal.sub,
        roles: req.principal.roles || [],
        scope: req.principal.scope || "",
        service_account: Boolean(req.principal.service_account),
      });
    }
    return res.json(publicUser(user));
  });

  app.get("/gateway/authorize", (req, res) => {
    const roles = String(req.query.roles || "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean);
    const token = tokenFromRequest(req);
    if (!token) {
      counters.authFailuresTotal += 1;
      return res.status(401).end();
    }
    try {
      const claims = verifyJwt(token);
      if (!hasAnyRole(claims, roles)) {
        counters.authFailuresTotal += 1;
        return res.status(403).end();
      }
      res.set("x-auth-user", claims.sub || claims.client_id || "");
      res.set("x-auth-roles", Array.isArray(claims.roles) ? claims.roles.join(",") : "");
      res.set("x-auth-scopes", claims.scope || "");
      res.set("x-auth-token-type", claims.type || "");
      return res.status(204).end();
    } catch (error) {
      counters.authFailuresTotal += 1;
      return res.status(401).end();
    }
  });

  app.get("/directory/users", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    res.json({ users: directoryUsers.map(publicUser) });
  });

  app.get("/rbac/roles", (req, res) => {
    res.json({
      roles: [
        { role: "employee", description: "Default internal workforce access" },
        { role: "developer", description: "Developer dashboard and build visibility" },
        { role: "hr", description: "HR case and employee record access" },
        { role: "finance", description: "Finance workflow access" },
        { role: "soc_analyst", description: "SOC observability and log access" },
        { role: "threat_hunter", description: "Threat hunting, telemetry pivoting, and attack pattern exploration" },
        { role: "incident_responder", description: "Incident reconstruction and response workflow access" },
        { role: "detection_engineer", description: "Detection rule validation and SIEM tuning" },
        { role: "platform_engineer", description: "Kubernetes, GitOps, telemetry, and service-mesh operations access" },
        { role: "resilience_engineer", description: "High-availability, failover, backup, and disaster-recovery simulation access" },
        { role: "compliance_manager", description: "Governance, policy, compliance, and audit evidence access" },
        { role: "red_team_operator", description: "Controlled internal exercise replay access" },
        { role: "admin", description: "Privileged enterprise administration" },
      ],
      service_roles: [...new Set(serviceAccounts.flatMap((account) => account.roles))].sort(),
    });
  });

  app.get("/service-accounts", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    res.json({
      service_accounts: serviceAccounts.map(({ client_id, name, roles, scopes }) => ({ client_id, name, roles, scopes })),
    });
  });

  app.get("/lab/tokens/audience-confusion", requireRoles(["developer", "admin"]), (req, res) => {
    const token = signJwtForAudience(
      {
        sub: "admin.enterprise",
        user_id: "u-9001",
        display_name: "Enterprise Administrator",
        roles: ["employee", "admin"],
        scope: "admin:read portal:developer:read",
        type: "access",
        service_account: false,
        lab_controlled: true,
        scenario: "jwt-audience-confusion",
      },
      "shield-pdp-ci",
      900,
    );
    recordLabEvent(req, "lab.identity.audience_confusion_token_issued", {
      severity: "high",
      mitre: ["T1550.001", "T1606"],
      token_audience: "shield-pdp-ci",
      expected_secure_result: "rejected_by_strict_audience_validation",
    });
    res.json({
      scenario: "jwt-audience-confusion",
      token,
      token_type: "bearer",
      audience: "shield-pdp-ci",
      expires_in: 900,
      expected_secure_result: "rejected_by_strict_audience_validation",
      unsafe_legacy_result: "accepted_only_by_stage3_legacy_lab_endpoint",
    });
  });

  app.get("/lab/tokens/stale", requireRoles(["developer", "admin"]), (req, res) => {
    const token = signJwt(
      {
        sub: "dimas.dev",
        user_id: "u-1002",
        display_name: "Dimas Pratama",
        roles: ["employee", "developer"],
        scope: "portal:developer:read internal:read",
        type: "access",
        service_account: false,
        lab_controlled: true,
        scenario: "stale-delegated-token",
      },
      -300,
    );
    recordLabEvent(req, "lab.identity.stale_token_issued", {
      severity: "medium",
      mitre: ["T1550.001"],
      expired_seconds_ago: 300,
      legacy_grace_seconds: STALE_TOKEN_GRACE_SECONDS,
    });
    res.json({
      scenario: "stale-delegated-token",
      token,
      token_type: "bearer",
      expired_seconds_ago: 300,
      legacy_grace_seconds: STALE_TOKEN_GRACE_SECONDS,
      expected_secure_result: "rejected_by_strict_expiration_validation",
      unsafe_legacy_result: "accepted_only_by_stage3_stale_session_endpoint",
    });
  });

}

const portalConfigs = {
  employee: {
    title: "Employee Portal",
    allowedRoles: ["employee", "developer", "hr", "finance", "soc_analyst", "admin"],
    summary: {
      workflow: "Internal workforce self-service",
      queue: [
        { id: "TASK-1042", title: "Review mandatory PDP handling refresher", status: "open" },
        { id: "TASK-1051", title: "Confirm emergency contact data", status: "pending" },
      ],
      systems: ["HR self-service", "Finance reimbursements", "Developer service desk"],
    },
  },
  hr: {
    title: "HR Portal",
    allowedRoles: ["hr", "admin"],
    summary: {
      workflow: "Sensitive workforce operations",
      cases: [
        { id: "HR-221", type: "onboarding", owner: "rani.hr", status: "in_review" },
        { id: "HR-225", type: "access-change", owner: "rani.hr", status: "awaiting_manager" },
      ],
      data_classification: "restricted-personnel",
    },
  },
  finance: {
    title: "Finance Portal",
    allowedRoles: ["finance", "admin"],
    summary: {
      workflow: "Finance approval and vendor payment operations",
      approvals: [
        { id: "FIN-7801", vendor: "PT Cloud Nusantara", amount: 18450000, status: "pending_dual_approval" },
        { id: "FIN-7808", vendor: "PT Secure Audit", amount: 7250000, status: "approved" },
      ],
      data_classification: "restricted-financial",
    },
  },
  admin: {
    title: "Internal Admin Dashboard",
    allowedRoles: ["admin", "soc_analyst"],
    summary: {
      workflow: "Privileged service administration and enterprise topology",
      privileged_services: ["auth-service", "vault-sim", "enterprise-rabbitmq", "log-collector"],
      change_windows: [{ id: "CHG-310", title: "Rotate service account lab secrets", status: "planned" }],
    },
  },
  developer: {
    title: "Developer Dashboard",
    allowedRoles: ["developer", "admin"],
    summary: {
      workflow: "Developer platform and CI/CD visibility",
      repositories: [
        { name: "customer-api", branch: "main", last_build: "passed" },
        { name: "employee-portal", branch: "release/stage2", last_build: "passed" },
      ],
      environments: ["dev", "staging", "lab"],
    },
  },
};

function registerPortalRoutes(mode) {
  const config = portalConfigs[mode] || portalConfigs.employee;
  const guard = requireRoles(config.allowedRoles);

  app.get("/", guard, (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${config.title}</title>
  <style>
    body{margin:0;background:#101820;color:#e5e7eb;font-family:Inter,system-ui,sans-serif}
    main{max-width:920px;margin:0 auto;padding:28px}
    .panel{border:1px solid #334155;background:#18212f;border-radius:8px;padding:18px;margin-top:16px}
    code{color:#93c5fd}
  </style>
</head>
<body>
  <main>
    <h1>${config.title}</h1>
    <p>Authenticated as <code>${req.principal.sub || req.principal.username}</code></p>
    <section class="panel">
      <h2>Workflow</h2>
      <p>${config.summary.workflow}</p>
      <pre>${JSON.stringify(config.summary, null, 2)}</pre>
    </section>
  </main>
</body>
</html>`);
  });

  app.get("/api/summary", guard, (req, res) => {
    res.json({
      service: SERVICE_NAME,
      portal: mode,
      principal: {
        sub: req.principal.sub || req.principal.username,
        roles: req.principal.roles || [],
      },
      summary: config.summary,
    });
  });

  app.get("/api/trust", guard, (req, res) => {
    res.json({
      service: SERVICE_NAME,
      trust_boundary: "enterprise-application",
      accepted_roles: config.allowedRoles,
      identity_provider: AUTH_SERVICE_URL,
      telemetry_sink: LOG_COLLECTOR_URL || null,
      service_account: SERVICE_ACCOUNT_ID,
    });
  });

  app.post("/internal/trust-check", requireRoles(["service_application", "service_admin", "service_devops"]), (req, res) => {
    res.json({
      status: "accepted",
      service: SERVICE_NAME,
      caller: req.principal.client_id || req.principal.sub,
      request_id: req.requestId,
    });
  });
}


function principalLabel(req) {
  if (req && req.principal) {
    return req.principal.client_id || req.principal.sub || req.principal.username || "unknown";
  }
  return (req && req.get && req.get("x-authenticated-user")) || "anonymous";
}

function recordLabEvent(req, event, extra = {}) {
  const payload = {
    event,
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    request_id: req.requestId,
    principal: principalLabel(req),
    lab_stage: event.startsWith("purple.") ? "stage4-detection-telemetry-purple-team" : "stage3-vulnerable-enterprise-ecosystem",
    severity: extra.severity || "medium",
    mitre: extra.mitre || [],
    ...extra,
  };
  log("INFO", "Stage 3 lab event recorded.", payload);
  emitTelemetry(payload);
}

function requirePipelineToken(req, res, next) {
  const provided = req.get("x-pipeline-token");
  if (!constantTimeEqual(provided, PIPELINE_TOKEN)) {
    counters.authFailuresTotal += 1;
    recordLabEvent(req, "lab.pipeline_token_rejected", {
      severity: "medium",
      mitre: ["T1078"],
      route: req.originalUrl,
    });
    return res.status(401).json({ error: "pipeline_token_required", request_id: req.requestId });
  }
  return next();
}

const internalDnsRecords = [
  { name: "auth.identity.shield.local", service: "auth-service", zone: "identity", port: 8080 },
  { name: "metadata.internal.shield.local", service: "service-discovery", zone: "enterprise", port: 8080 },
  { name: "internal-api.enterprise.shield.local", service: "internal-api", zone: "enterprise", port: 8080 },
  { name: "git.devops.shield.local", service: "git-sim", zone: "devops", port: 8080 },
  { name: "ci.devops.shield.local", service: "ci-sim", zone: "devops", port: 8080 },
  { name: "artifacts.devops.shield.local", service: "artifact-store", zone: "devops", port: 8080 },
  { name: "vault.identity.shield.local", service: "secrets-broker", zone: "identity", port: 8080 },
];

const serviceCatalog = [
  { service: "auth-service", trust: "token issuer", exposed_via_gateway: true, privileged: true },
  { service: "internal-api", trust: "internal business API", exposed_via_gateway: true, privileged: true },
  { service: "service-discovery", trust: "inventory and metadata", exposed_via_gateway: true, privileged: false },
  { service: "git-sim", trust: "source control", exposed_via_gateway: true, privileged: false },
  { service: "ci-sim", trust: "pipeline execution control plane", exposed_via_gateway: true, privileged: true },
  { service: "artifact-store", trust: "build artifact distribution", exposed_via_gateway: true, privileged: false },
  { service: "secrets-broker", trust: "deployment secret read broker", exposed_via_gateway: true, privileged: true },
];

const enterpriseMetadata = {
  instance_id: "i-lab-internal-api-01",
  hostname: "metadata.internal.shield.local",
  network_zone: "shield_pdp_enterprise",
  environment: "staging-lab",
  service_account: "internal-api",
  attached_policies: ["service-discovery-read", "artifact-read", "legacy-deploy-read"],
  tags: { owner: "platform-engineering", data_classification: "internal" },
};

const repositories = [
  {
    name: "customer-api",
    default_branch: "main",
    owner: "platform-engineering",
    protected_branches: ["main", "release/*"],
    ci_file: ".shield-ci.yml",
    last_commit: "8f4ad3c-stage3-lab",
  },
  {
    name: "employee-portal",
    default_branch: "release/stage2",
    owner: "business-apps",
    protected_branches: ["release/*"],
    ci_file: ".shield-ci.yml",
    last_commit: "64db9e1-stage3-lab",
  },
];

const pipelineRuns = [];

const latestArtifact = {
  artifact_id: "artifact-customer-api-20260527.1",
  repository: "customer-api",
  branch: "main",
  digest: "sha256:3d4b3b0e5b6f7c8d9e0f-stage3-lab",
  created_at: "2026-05-27T00:00:00.000Z",
  classification: "internal-build-artifact",
  env_snapshot: {
    DEPLOY_ENV: "staging",
    INTERNAL_API_URL: "http://internal-api:8080",
    SERVICE_DISCOVERY_URL: "http://service-discovery:8080",
    DEPLOY_ROLE: "ci-deploy-legacy",
    VAULT_POLICY: "legacy-deploy-read",
  },
};

const vaultPolicies = [
  { name: "developer-read-metadata", paths: ["metadata/*"], principals: ["developer", "admin"] },
  { name: "ci-deploy-legacy", paths: ["deploy/prod"], principals: ["ci-sim"], legacy_token_allowed: true },
  { name: "break-glass-admin", paths: ["*"], principals: ["admin"], approval_required: true },
];

const syntheticSecrets = {
  "deploy/prod": {
    DEPLOY_API_TOKEN: "lab-secret-synthetic-deploy-token",
    SIGNING_KEY_REF: "lab-kms-ref-prod-signing-key",
    DATABASE_URL_REF: "vault://database/prod/customer-api",
  },
};

function registerInternalApiRoutes() {
  const internalGuard = requireRoles(["developer", "admin"]);

  app.get("/", requireRoles(["developer", "admin", "soc_analyst"]), (req, res) => {
    res.json({
      service: SERVICE_NAME,
      mode: SERVICE_MODE,
      endpoints: [
        "/lab/audience-confusion/admin-context",
        "/secure/admin-context",
        "/lab/stale-session/delegated",
        "/lab/link-preview",
        "/lab/admin-shadow/users",
      ],
    });
  });

  app.post("/lab/audience-confusion/admin-context", internalGuard, (req, res) => {
    try {
      const delegated = verifyJwtWithOptions(req.body.delegated_token, { ignoreAudience: true });
      if (!hasAnyRole(delegated, ["admin"])) {
        counters.authFailuresTotal += 1;
        return res.status(403).json({ error: "delegated_admin_required", request_id: req.requestId });
      }
      recordLabEvent(req, "lab.legacy_audience_token_accepted", {
        severity: "high",
        mitre: ["T1550.001", "T1606"],
        delegated_sub: delegated.sub,
        delegated_audience: delegated.aud,
      });
      return res.json({
        status: "legacy_context_accepted",
        validator: "legacy-audience-unaware-validator",
        delegated_principal: { sub: delegated.sub, roles: delegated.roles || [], audience: delegated.aud },
        request_id: req.requestId,
      });
    } catch (error) {
      counters.authFailuresTotal += 1;
      return res.status(403).json({ error: "delegated_token_rejected", request_id: req.requestId });
    }
  });

  app.post("/secure/admin-context", internalGuard, (req, res) => {
    try {
      const delegated = verifyJwt(req.body.delegated_token);
      if (!hasAnyRole(delegated, ["admin"])) {
        counters.authFailuresTotal += 1;
        return res.status(403).json({ error: "delegated_admin_required", request_id: req.requestId });
      }
      return res.json({
        status: "strict_context_accepted",
        validator: "issuer-audience-expiry-rbac-validator",
        delegated_principal: { sub: delegated.sub, roles: delegated.roles || [], audience: delegated.aud },
        request_id: req.requestId,
      });
    } catch (error) {
      counters.authFailuresTotal += 1;
      return res.status(403).json({ error: "strict_delegated_token_rejected", request_id: req.requestId });
    }
  });

  app.post("/lab/stale-session/delegated", internalGuard, (req, res) => {
    try {
      const delegated = verifyJwtWithOptions(req.body.delegated_token, {
        allowExpiredGraceSeconds: STALE_TOKEN_GRACE_SECONDS,
      });
      recordLabEvent(req, "lab.stale_delegated_token_accepted", {
        severity: "medium",
        mitre: ["T1550.001"],
        delegated_sub: delegated.sub,
        token_exp: delegated.exp,
        grace_seconds: STALE_TOKEN_GRACE_SECONDS,
      });
      return res.json({
        status: "legacy_stale_session_accepted",
        delegated_principal: { sub: delegated.sub, roles: delegated.roles || [], exp: delegated.exp },
        request_id: req.requestId,
      });
    } catch (error) {
      counters.authFailuresTotal += 1;
      return res.status(403).json({ error: "stale_delegated_token_rejected", request_id: req.requestId });
    }
  });

  app.post("/lab/link-preview", internalGuard, async (req, res) => {
    const targets = {
      metadata: "http://service-discovery:8080/internal/metadata/instance",
      service_map: "http://service-discovery:8080/internal/service-map",
    };
    const target = String(req.body.target || req.query.target || "").trim();
    const url = targets[target];
    if (!url) {
      return res.status(400).json({ error: "unsupported_preview_target", allowed_targets: Object.keys(targets), request_id: req.requestId });
    }
    try {
      const response = await fetch(url, {
        headers: { "x-request-id": req.requestId, "x-lab-preview-service": SERVICE_NAME },
        signal: AbortSignal.timeout(2500),
      });
      const raw = await response.text();
      let body = raw;
      try {
        body = JSON.parse(raw);
      } catch (error) {
        body = { raw };
      }
      recordLabEvent(req, "lab.ssrf_internal_service_preview", {
        severity: "high",
        mitre: ["T1190", "T1590"],
        target,
        upstream_status: response.status,
      });
      return res.json({
        status: "preview_fetched",
        target,
        upstream_status: response.status,
        body,
        request_id: req.requestId,
      });
    } catch (error) {
      return res.status(502).json({ error: "preview_fetch_failed", detail: error.message, request_id: req.requestId });
    }
  });

  app.get("/lab/admin-shadow/users", requireRoles(["service_application", "service_admin", "service_devops"]), (req, res) => {
    recordLabEvent(req, "lab.service_account_admin_shadow_access", {
      severity: "high",
      mitre: ["T1078", "T1550.001"],
      caller: principalLabel(req),
    });
    res.json({
      status: "shadow_admin_scope_accepted",
      validator: "legacy-service-role-only-check",
      caller: principalLabel(req),
      users: directoryUsers.map((user) => ({
        username: user.username,
        department: user.department,
        roles: user.roles,
        manager: user.manager,
      })),
      request_id: req.requestId,
    });
  });
}

function registerServiceDiscoveryRoutes() {
  const guard = requireRoles(["employee", "developer", "hr", "finance", "soc_analyst", "admin"]);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/dns", "/api/service-map"] });
  });

  app.get("/api/dns", guard, (req, res) => {
    recordLabEvent(req, "lab.service_discovery_dns_recon", {
      severity: "medium",
      mitre: ["T1590", "T1046"],
      records_returned: internalDnsRecords.length,
    });
    res.json({ zone: "shield.local", records: internalDnsRecords, request_id: req.requestId });
  });

  app.get("/api/service-map", guard, (req, res) => {
    recordLabEvent(req, "lab.service_discovery_map_recon", {
      severity: "medium",
      mitre: ["T1590", "T1046"],
      services_returned: serviceCatalog.length,
    });
    res.json({ services: serviceCatalog, request_id: req.requestId });
  });

  app.get("/internal/metadata/instance", (req, res) => {
    recordLabEvent(req, "lab.internal_metadata_read", {
      severity: "high",
      mitre: ["T1190", "T1590"],
      source: req.get("x-lab-preview-service") || "direct-internal",
    });
    res.json({ metadata: enterpriseMetadata, request_id: req.requestId });
  });

  app.get("/internal/service-map", (req, res) => {
    res.json({ services: serviceCatalog, request_id: req.requestId });
  });
}

function registerGitRoutes() {
  const guard = requireRoles(["developer", "admin"]);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/repos", "/api/repos/customer-api/ci-config"] });
  });

  app.get("/api/repos", guard, (req, res) => {
    res.json({ repositories, request_id: req.requestId });
  });

  app.get("/api/repos/customer-api/ci-config", guard, (req, res) => {
    recordLabEvent(req, "lab.pipeline_token_exposed", {
      severity: "high",
      mitre: ["T1552", "T1078"],
      repository: "customer-api",
      file: ".shield-ci.yml",
    });
    res.json({
      repository: "customer-api",
      file: ".shield-ci.yml",
      branch: "main",
      config: {
        runner: "ci-sim",
        deployment_environment: "staging",
        artifact_publish: "artifact-store://customer-api/latest",
        variables: {
          PIPELINE_TOKEN,
          DEPLOY_ROLE: "ci-deploy-legacy",
          INTERNAL_API_URL: "http://internal-api:8080",
        },
      },
      weakness: "pipeline token stored in repository CI config for lab simulation",
      request_id: req.requestId,
    });
  });
}

function registerCiRoutes() {
  app.get("/", requireRoles(["developer", "admin", "soc_analyst"]), (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/pipelines/customer-api/run", "/api/pipelines/customer-api/runs"] });
  });

  app.post("/api/pipelines/customer-api/run", requirePipelineToken, (req, res) => {
    const run = {
      id: `run-${String(pipelineRuns.length + 1).padStart(4, "0")}`,
      repository: "customer-api",
      branch: String(req.body.branch || "main"),
      commit: String(req.body.commit || "manual-stage3-lab"),
      requested_change: String(req.body.change || "configuration-update"),
      requested_by: principalLabel(req),
      status: "simulated_queued",
      created_at: new Date().toISOString(),
      controls: {
        command_execution: false,
        deploys_real_artifact: false,
        isolated_lab_only: true,
      },
    };
    pipelineRuns.push(run);
    recordLabEvent(req, "lab.poisoned_build_flow_simulated", {
      severity: "high",
      mitre: ["T1195.002", "T1078"],
      repository: run.repository,
      run_id: run.id,
      branch: run.branch,
    });
    res.status(202).json({ pipeline: run, request_id: req.requestId });
  });

  app.get("/api/pipelines/customer-api/runs", requireRoles(["developer", "admin", "soc_analyst"]), (req, res) => {
    res.json({ runs: pipelineRuns.slice(-25).reverse(), request_id: req.requestId });
  });
}

function registerArtifactRoutes() {
  const guard = requireRoles(["employee", "developer", "hr", "finance", "soc_analyst", "admin"]);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/public/latest"] });
  });

  app.get("/public/latest", guard, (req, res) => {
    recordLabEvent(req, "lab.artifact_environment_exposed", {
      severity: "medium",
      mitre: ["T1552", "T1082"],
      artifact_id: latestArtifact.artifact_id,
    });
    res.json({ artifact: latestArtifact, request_id: req.requestId });
  });
}

function registerSecretsRoutes() {
  app.get("/", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/policies", "/api/env", "/api/legacy-read/deploy/prod"] });
  });

  app.get("/api/policies", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    res.json({ policies: vaultPolicies, request_id: req.requestId });
  });

  app.get("/api/env", requireRoles(["developer", "admin"]), (req, res) => {
    recordLabEvent(req, "lab.secrets_environment_exposure", {
      severity: "medium",
      mitre: ["T1552"],
      service: SERVICE_NAME,
    });
    res.json({
      environment: {
        SERVICE_NAME,
        SERVICE_MODE,
        AUTH_SERVICE_URL,
        LOG_COLLECTOR_URL,
        ENTERPRISE_JWT_ISSUER: ISSUER,
        ENTERPRISE_JWT_AUDIENCE: AUDIENCE,
      },
      request_id: req.requestId,
    });
  });

  app.get("/api/legacy-read/deploy/prod", requirePipelineToken, (req, res) => {
    recordLabEvent(req, "lab.secret_legacy_token_read", {
      severity: "critical",
      mitre: ["T1552", "T1528"],
      secret_path: "deploy/prod",
      token_source: "x-pipeline-token",
    });
    res.json({
      secret_path: "deploy/prod",
      data: syntheticSecrets["deploy/prod"],
      policy: "ci-deploy-legacy",
      warning: "synthetic lab secret; not usable outside this isolated environment",
      request_id: req.requestId,
    });
  });
}

const stage5GuardRoles = [
  "admin",
  "soc_analyst",
  "detection_engineer",
  "red_team_operator",
  "service_redteam",
  "service_operations",
  "service_observability",
];

const adversaryCampaigns = [
  {
    id: "insider-threat-simulation",
    name: "Insider threat simulation",
    objective: "Exercise identity misuse, internal recon, and low-volume collection telemetry.",
    profile: "low-and-slow",
    opsec: { timing: "business-hours", jitter_percent: 35, traffic_blending: "employee-portal-browsing", low_noise: true },
    mitre: ["T1087", "T1069", "T1119", "T1029"],
    stages: [
      { name: "directory review", service: "identity", event: "adversary.operation.step", severity: "medium", mitre: ["T1087", "T1069"] },
      { name: "internal portal access", service: "employee-portal", event: "adversary.operation.step", severity: "low", mitre: ["T1029"] },
      { name: "controlled collection marker", service: "artifact-store", event: "adversary.operation.step", severity: "medium", mitre: ["T1119"] },
    ],
  },
  {
    id: "cicd-compromise-simulation",
    name: "CI/CD compromise simulation",
    objective: "Model a pipeline-token workflow without executing builds or deploying artifacts.",
    profile: "operator-paced",
    opsec: { timing: "change-window", jitter_percent: 20, traffic_blending: "developer-dashboard", low_noise: false },
    mitre: ["T1552", "T1078", "T1195.002"],
    stages: [
      { name: "repository configuration review", service: "git-sim", event: "adversary.operation.step", severity: "high", mitre: ["T1552", "T1078"] },
      { name: "pipeline control-plane simulation", service: "ci-sim", event: "adversary.operation.step", severity: "high", mitre: ["T1195.002"] },
      { name: "artifact provenance review", service: "artifact-store", event: "adversary.operation.step", severity: "medium", mitre: ["T1082"] },
    ],
  },
  {
    id: "token-abuse-campaign",
    name: "Token abuse campaign",
    objective: "Replay delegated-token abuse, stale-token acceptance, and service account trust boundary telemetry.",
    profile: "identity-centric",
    opsec: { timing: "staggered", jitter_percent: 25, traffic_blending: "auth-service", low_noise: true },
    mitre: ["T1550.001", "T1606", "T1078"],
    stages: [
      { name: "delegated token validation gap", service: "internal-api", event: "adversary.operation.step", severity: "critical", mitre: ["T1550.001", "T1606"] },
      { name: "service account pivot review", service: "internal-api", event: "adversary.operation.step", severity: "high", mitre: ["T1078", "T1550.001"] },
      { name: "identity abuse correlation marker", service: "correlation-engine", event: "adversary.operation.step", severity: "high", mitre: ["T1550.001"] },
    ],
  },
  {
    id: "internal-recon-campaign",
    name: "Internal recon campaign",
    objective: "Model enterprise discovery across DNS, service catalog, and metadata surfaces.",
    profile: "discovery-focused",
    opsec: { timing: "staggered", jitter_percent: 30, traffic_blending: "service-discovery", low_noise: true },
    mitre: ["T1590", "T1046", "T1082"],
    stages: [
      { name: "internal DNS discovery", service: "service-discovery", event: "adversary.operation.step", severity: "medium", mitre: ["T1590"] },
      { name: "service map review", service: "service-discovery", event: "adversary.operation.step", severity: "medium", mitre: ["T1046"] },
      { name: "metadata access simulation", service: "service-discovery", event: "adversary.operation.step", severity: "high", mitre: ["T1082", "T1590"] },
    ],
  },
  {
    id: "secrets-abuse-campaign",
    name: "Secrets abuse campaign",
    objective: "Exercise secret policy misuse, environment exposure, and privileged token telemetry.",
    profile: "secrets-focused",
    opsec: { timing: "after-hours-simulation", jitter_percent: 15, traffic_blending: "secrets-broker", low_noise: false },
    mitre: ["T1552", "T1528", "T1078"],
    stages: [
      { name: "environment exposure review", service: "secrets-broker", event: "adversary.operation.step", severity: "medium", mitre: ["T1552"] },
      { name: "legacy policy path simulation", service: "secrets-broker", event: "adversary.operation.step", severity: "critical", mitre: ["T1552", "T1528"] },
      { name: "credential use correlation marker", service: "detection-engine", event: "adversary.operation.step", severity: "high", mitre: ["T1078"] },
    ],
  },
];

const beaconProfiles = [
  {
    id: "enterprise-web-egress",
    name: "Enterprise web egress",
    callback_interval_seconds: 60,
    jitter_percent: 20,
    sleep_profile: "business-hours",
    encrypted_telemetry_simulation: true,
    mode: "standard",
  },
  {
    id: "low-and-slow",
    name: "Low-and-slow operator profile",
    callback_interval_seconds: 300,
    jitter_percent: 35,
    sleep_profile: "staggered",
    encrypted_telemetry_simulation: true,
    mode: "low-noise",
  },
  {
    id: "incident-replay",
    name: "Incident replay profile",
    callback_interval_seconds: 15,
    jitter_percent: 5,
    sleep_profile: "accelerated-replay",
    encrypted_telemetry_simulation: true,
    mode: "replay",
  },
];

const beaconSessions = [];
const operationRuns = [];
const persistenceRecords = [];

const safeBeaconTasks = {
  enumerate_services: {
    label: "Enumerate service catalog",
    severity: "medium",
    mitre: ["T1590", "T1046"],
    result: () => ({ services: serviceCatalog.map((item) => ({ service: item.service, trust: item.trust, privileged: item.privileged })) }),
  },
  collect_identity_context: {
    label: "Collect identity context",
    severity: "medium",
    mitre: ["T1087", "T1069"],
    result: () => ({ users: directoryUsers.map((user) => ({ username: user.username, department: user.department, roles: user.roles })) }),
  },
  simulate_ci_pivot: {
    label: "Simulate CI/CD pivot",
    severity: "high",
    mitre: ["T1195.002", "T1078"],
    result: () => ({ path: ["git-sim", "ci-sim", "artifact-store"], execution: "not_performed", deployment: "not_performed" }),
  },
  simulate_secret_probe: {
    label: "Simulate secret broker probe",
    severity: "high",
    mitre: ["T1552", "T1528"],
    result: () => ({ path_checked: "deploy/prod", secret_values_returned: false, policy: "ci-deploy-legacy" }),
  },
  simulate_admin_route_check: {
    label: "Simulate admin route traversal",
    severity: "high",
    mitre: ["T1078", "T1069"],
    result: () => ({ route: "/internal/admin/api/summary", privileged_data_returned: false, status: "simulated_only" }),
  },
  sleep: {
    label: "Sleep and jitter simulation",
    severity: "low",
    mitre: ["T1029"],
    result: () => ({ sleep_applied: "simulated", timer_started: false }),
  },
  simulate_command: {
    label: "Synthetic command result simulation",
    severity: "medium",
    mitre: ["T1059"],
    result: (body) => {
      const profiles = {
        "whoami-profile": { synthetic_output: "shield-lab\\simulated-operator", command_executed: false },
        "hostname-profile": { synthetic_output: "dev-workstation-sim-01", command_executed: false },
        "service-health-profile": { synthetic_output: "22 simulated services healthy", command_executed: false },
      };
      return profiles[body.command_profile] || null;
    },
  },
};

const trafficProfiles = [
  {
    id: "business-hours-low-noise",
    name: "Business-hours low-noise routing",
    listener: "https-listener-simulation",
    jitter_percent: 30,
    route_rotation: "per-operation",
    allowed_methods: ["GET", "POST"],
    opsec: { traffic_blending: "employee-portal", delayed_execution: true },
  },
  {
    id: "rotating-route-simulation",
    name: "Rotating redirect route simulation",
    listener: "https-listener-simulation",
    jitter_percent: 15,
    route_rotation: "per-callback",
    allowed_methods: ["GET", "POST"],
    opsec: { traffic_blending: "developer-dashboard", delayed_execution: false },
  },
  {
    id: "controlled-failover",
    name: "Controlled failover routing",
    listener: "https-listener-simulation",
    jitter_percent: 10,
    route_rotation: "failover-only",
    allowed_methods: ["GET"],
    opsec: { traffic_blending: "observability-api", delayed_execution: false },
  },
];

const redirectorRoutes = [
  { id: "edge-to-beacon", chain: ["enterprise-gateway", "redirector-sim", "beacon-sim"], target: "beacon-sim", external_callback: false },
  { id: "edge-to-ops", chain: ["enterprise-gateway", "redirector-sim", "adversary-control"], target: "adversary-control", external_callback: false },
  { id: "soc-replay-route", chain: ["enterprise-gateway", "redirector-sim", "soc-dashboard"], target: "soc-dashboard", external_callback: false },
];

const pivotPaths = [
  {
    id: "delegated-token-pivot",
    name: "Delegated token pivot",
    source_zone: "identity",
    target_zone: "enterprise",
    route: ["auth-service", "internal-api", "internal-admin-dashboard"],
    trust_boundary_crossings: ["identity-to-enterprise"],
    mitre: ["T1550.001", "T1078", "T1021"],
    severity: "high",
  },
  {
    id: "cicd-runner-pivot",
    name: "CI runner pivot",
    source_zone: "devops",
    target_zone: "enterprise",
    route: ["git-sim", "ci-sim", "artifact-store", "internal-api"],
    trust_boundary_crossings: ["devops-to-enterprise"],
    mitre: ["T1195.002", "T1078", "T1021"],
    severity: "high",
  },
  {
    id: "service-account-pivot",
    name: "Service account trust pivot",
    source_zone: "enterprise",
    target_zone: "identity",
    route: ["employee-portal", "internal-api", "secrets-broker"],
    trust_boundary_crossings: ["enterprise-to-identity"],
    mitre: ["T1078", "T1550.001", "T1528"],
    severity: "critical",
  },
  {
    id: "admin-route-traversal",
    name: "Internal admin route traversal",
    source_zone: "enterprise",
    target_zone: "enterprise",
    route: ["developer-dashboard", "internal-api", "internal-admin-dashboard"],
    trust_boundary_crossings: ["role-boundary"],
    mitre: ["T1069", "T1087", "T1021"],
    severity: "medium",
  },
];

const persistenceMechanisms = [
  { id: "scheduled-task-sim", name: "Scheduled task simulation", reversible: true, real_system_change: false, mitre: ["T1053.005"] },
  { id: "startup-entry-sim", name: "Startup entry simulation", reversible: true, real_system_change: false, mitre: ["T1547"] },
  { id: "token-cache-sim", name: "Token cache simulation", reversible: true, real_system_change: false, mitre: ["T1550.001"] },
  { id: "ci-runner-registration-sim", name: "CI runner registration simulation", reversible: true, real_system_change: false, mitre: ["T1053", "T1195.002"] },
  { id: "service-registration-sim", name: "Service registration simulation", reversible: true, real_system_change: false, mitre: ["T1543"] },
  { id: "credential-cache-sim", name: "Credential cache simulation", reversible: true, real_system_change: false, mitre: ["T1555"] },
];

function clampNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, minimum), maximum);
}

function stage5Controls(extra = {}) {
  return {
    isolated_lab_only: true,
    destructive_actions: false,
    command_execution: false,
    external_callbacks: false,
    public_targets: false,
    reversible: true,
    telemetry_observable: true,
    ...extra,
  };
}

function recordAdversaryEvent(req, event, extra = {}) {
  const { controls, ...details } = extra;
  const payload = {
    event,
    event_id: crypto.randomUUID(),
    request_id: req.requestId,
    principal: principalLabel(req),
    lab_stage: "stage5-adversary-operations",
    severity: details.severity || "medium",
    mitre: details.mitre || [],
    attack_simulation: true,
    safe_simulation: true,
    simulation_scope: "isolated-lab",
    controls: stage5Controls(controls || {}),
    ...details,
  };
  log("INFO", "Stage 5 controlled adversary simulation event recorded.", payload);
  emitTelemetry(payload);
  return payload;
}

function findById(items, id) {
  return items.find((item) => item.id === id);
}

function syntheticJitterSeconds(intervalSeconds, jitterPercent) {
  const window = Math.round((intervalSeconds * jitterPercent) / 100);
  if (window <= 0) {
    return intervalSeconds;
  }
  return Math.max(1, intervalSeconds + crypto.randomInt(-window, window + 1));
}

function runAdversaryCampaign(req, campaign) {
  const runId = stableId("oprun", [campaign.id, req.requestId, Date.now().toString()]);
  const emitted = [];
  emitted.push(
    recordAdversaryEvent(req, "adversary.operation.started", {
      severity: "medium",
      mitre: campaign.mitre,
      operation_run_id: runId,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      opsec_profile: campaign.profile,
      attack_chain_stage: "operation-start",
    }),
  );
  if (campaign.opsec.low_noise) {
    emitted.push(
      recordAdversaryEvent(req, "adversary.opsec.low_noise_profile_used", {
        severity: "medium",
        mitre: ["T1029", "T1071.001"],
        operation_run_id: runId,
        campaign_id: campaign.id,
        opsec: campaign.opsec,
        attack_chain_stage: "opsec",
      }),
    );
  }
  campaign.stages.forEach((stage, index) => {
    emitted.push(
      recordAdversaryEvent(req, stage.event, {
        severity: stage.severity,
        mitre: stage.mitre,
        operation_run_id: runId,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        attack_chain_stage: stage.name,
        simulated_service: stage.service,
        sequence: index + 1,
      }),
    );
  });
  emitted.push(
    recordAdversaryEvent(req, "adversary.operation.completed", {
      severity: maxSeverity(campaign.stages.map((stage) => stage.severity)),
      mitre: campaign.mitre,
      operation_run_id: runId,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      emitted_events: emitted.length + 1,
      attack_chain_stage: "operation-complete",
    }),
  );
  const run = {
    run_id: runId,
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    operator: principalLabel(req),
    status: "completed",
    started_at: emitted[0].timestamp || new Date().toISOString(),
    completed_at: new Date().toISOString(),
    emitted_events: emitted.map((event) => ({ event_id: event.event_id, event: event.event, severity: event.severity, mitre: event.mitre })),
    controls: stage5Controls(),
  };
  operationRuns.push(run);
  return run;
}

function registerAdversaryControlRoutes() {
  const guard = requireRoles(stage5GuardRoles);

  app.get("/", guard, (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shield-PDP Adversary Operations</title>
  <style>
    body{margin:0;background:#111827;color:#e5e7eb;font-family:Inter,system-ui,sans-serif}
    main{max-width:1180px;margin:0 auto;padding:24px}
    section{border-top:1px solid #374151;padding:16px 0}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
    .tile{border:1px solid #374151;border-radius:8px;padding:12px;background:#172033}
    code{color:#93c5fd}
    pre{white-space:pre-wrap;background:#0f172a;border:1px solid #374151;border-radius:8px;padding:14px}
  </style>
</head>
<body>
  <main>
    <h1>Shield-PDP Adversary Operations</h1>
    <section><p>Operator: <code>${req.principal.sub || req.principal.username}</code></p></section>
    <section class="grid">
      <div class="tile"><strong>Campaigns</strong><pre>${JSON.stringify(adversaryCampaigns.map((item) => item.id), null, 2)}</pre></div>
      <div class="tile"><strong>Active Runs</strong><pre>${JSON.stringify(operationRuns.slice(-5), null, 2)}</pre></div>
    </section>
    <section><pre>${JSON.stringify({ endpoints: ["/api/campaigns", "/api/operator-sessions", "/api/replay/adversary-timeline", "/api/heatmap"] }, null, 2)}</pre></section>
  </main>
</body>
</html>`);
  });

  app.get("/api/campaigns", guard, (req, res) => {
    res.json({ campaigns: adversaryCampaigns, request_id: req.requestId });
  });

  app.get("/api/campaigns/:campaignId", guard, (req, res) => {
    const campaign = findById(adversaryCampaigns, req.params.campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "campaign_not_found", request_id: req.requestId });
    }
    return res.json({ campaign, request_id: req.requestId });
  });

  app.post("/api/campaigns/:campaignId/run", guard, (req, res) => {
    const campaign = findById(adversaryCampaigns, req.params.campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "campaign_not_found", request_id: req.requestId });
    }
    const run = runAdversaryCampaign(req, campaign);
    return res.status(202).json({ operation_run: run, request_id: req.requestId });
  });

  app.get("/api/operator-sessions", guard, async (req, res) => {
    let beaconOverview = { sessions: beaconSessions.slice(-50).reverse(), source: "local" };
    let persistenceOverview = { active: persistenceRecords.filter((item) => item.status === "simulated_registered"), source: "local" };
    if (SERVICE_MODE === "adversary-control" && process.env.STAGE5_TARGETS_ENABLED === "true") {
      try {
        beaconOverview = await fetchJsonWithServiceAuth(`${BEACON_SIM_URL}/api/sessions`, { requestId: req.requestId });
      } catch (error) {
        beaconOverview = { sessions: [], source: "beacon-sim", error: error.message };
      }
      try {
        persistenceOverview = await fetchJsonWithServiceAuth(`${PERSISTENCE_SIM_URL}/api/active`, { requestId: req.requestId });
      } catch (error) {
        persistenceOverview = { active: [], source: "persistence-sim", error: error.message };
      }
    }
    res.json({
      operator_sessions: operationRuns.slice(-50).reverse(),
      active_beacon_sessions: (beaconOverview.sessions || []).filter((session) => session.status === "simulated_active").length,
      beacon_overview: beaconOverview,
      persistence_records: (persistenceOverview.active || []).length,
      persistence_overview: persistenceOverview,
      request_id: req.requestId,
    });
  });

  app.get("/api/heatmap", guard, (req, res) => {
    const coverage = {};
    for (const campaign of adversaryCampaigns) {
      for (const technique of campaign.mitre) {
        coverage[technique] = (coverage[technique] || 0) + 1;
      }
    }
    res.json({
      heatmap: Object.entries(coverage).map(([technique, count]) => ({ technique, configured_campaigns: count })),
      service_compromise_visualization: pivotPaths.map((pathItem) => ({
        path_id: pathItem.id,
        route: pathItem.route,
        trust_boundary_crossings: pathItem.trust_boundary_crossings,
        severity: pathItem.severity,
      })),
      request_id: req.requestId,
    });
  });

  app.get("/api/replay/adversary-timeline", guard, (req, res) => {
    res.json({
      replay_catalog: adversaryCampaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, stages: campaign.stages.length })),
      operation_runs: operationRuns.slice(-25).reverse(),
      request_id: req.requestId,
    });
  });

  app.post("/api/replay/adversary-timeline", guard, (req, res) => {
    const campaignId = req.body.campaign_id || "token-abuse-campaign";
    const campaign = findById(adversaryCampaigns, campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "campaign_not_found", request_id: req.requestId });
    }
    const replayId = stableId("advreplay", [campaign.id, req.requestId, Date.now().toString()]);
    const replayEvents = [
      { event: "adversary.replay.started", severity: "low", mitre: [] },
      { event: "adversary.beacon.heartbeat", severity: "medium", mitre: ["T1071.001"] },
      { event: "adversary.pivot.simulated", severity: "high", mitre: ["T1021", "T1078"] },
      { event: "adversary.persistence.registered", severity: "high", mitre: ["T1053.005"] },
      { event: "adversary.operation.completed", severity: "high", mitre: campaign.mitre },
    ];
    replayEvents.forEach((item, index) => {
      recordAdversaryEvent(req, item.event, {
        severity: item.severity,
        mitre: item.mitre,
        replay_id: replayId,
        campaign_id: campaign.id,
        replay_step: index + 1,
        attack_chain_stage: "adversary-replay",
      });
    });
    return res.status(202).json({
      replay_id: replayId,
      campaign_id: campaign.id,
      emitted_events: replayEvents.length,
      controls: stage5Controls(),
      request_id: req.requestId,
    });
  });
}

function registerBeaconRoutes() {
  const guard = requireRoles(stage5GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/profiles", "/api/sessions", "/api/sessions/:sessionId/heartbeat", "/api/sessions/:sessionId/tasks"] });
  });

  app.get("/api/profiles", guard, (req, res) => {
    res.json({ profiles: beaconProfiles, safe_task_types: Object.keys(safeBeaconTasks), request_id: req.requestId });
  });

  app.get("/api/sessions", guard, (req, res) => {
    res.json({ sessions: beaconSessions.slice(-50).reverse(), request_id: req.requestId });
  });

  app.post("/api/sessions", guard, (req, res) => {
    const profile = findById(beaconProfiles, req.body.profile_id || "enterprise-web-egress");
    if (!profile) {
      return res.status(400).json({ error: "unsupported_beacon_profile", allowed_profiles: beaconProfiles.map((item) => item.id), request_id: req.requestId });
    }
    const session = {
      session_id: stableId("beacon", [profile.id, req.requestId, Date.now().toString()]),
      profile_id: profile.id,
      mode: req.body.mode || profile.mode,
      operator: principalLabel(req),
      status: "simulated_active",
      callback_interval_seconds: clampNumber(req.body.callback_interval_seconds, profile.callback_interval_seconds, 10, 3600),
      jitter_percent: clampNumber(req.body.jitter_percent, profile.jitter_percent, 0, 60),
      sleep_profile: req.body.sleep_profile || profile.sleep_profile,
      encrypted_telemetry_simulation: true,
      heartbeat_count: 0,
      tasks: [],
      created_at: new Date().toISOString(),
      last_heartbeat_at: null,
      controls: stage5Controls({ beacon_payload: "synthetic-state-only" }),
    };
    beaconSessions.push(session);
    recordAdversaryEvent(req, "adversary.beacon.session_started", {
      severity: "medium",
      mitre: ["T1071.001", "T1105"],
      beacon_session_id: session.session_id,
      profile_id: session.profile_id,
      callback_interval_seconds: session.callback_interval_seconds,
      jitter_percent: session.jitter_percent,
      encrypted_telemetry_simulation: true,
      controls: { beacon_payload: "synthetic-state-only" },
    });
    return res.status(201).json({ session, request_id: req.requestId });
  });

  app.post("/api/sessions/:sessionId/heartbeat", guard, (req, res) => {
    const session = beaconSessions.find((item) => item.session_id === req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "beacon_session_not_found", request_id: req.requestId });
    }
    session.heartbeat_count += 1;
    session.last_heartbeat_at = new Date().toISOString();
    const nextCallbackSeconds = syntheticJitterSeconds(session.callback_interval_seconds, session.jitter_percent);
    const event = recordAdversaryEvent(req, "adversary.beacon.heartbeat", {
      severity: session.mode === "low-noise" ? "high" : "medium",
      mitre: ["T1071.001"],
      beacon_session_id: session.session_id,
      profile_id: session.profile_id,
      callback_interval_seconds: session.callback_interval_seconds,
      jitter_percent: session.jitter_percent,
      next_callback_seconds: nextCallbackSeconds,
      encrypted_telemetry_simulation: true,
    });
    return res.json({ heartbeat: { session_id: session.session_id, count: session.heartbeat_count, next_callback_seconds: nextCallbackSeconds, event_id: event.event_id }, request_id: req.requestId });
  });

  app.post("/api/sessions/:sessionId/tasks", guard, (req, res) => {
    const session = beaconSessions.find((item) => item.session_id === req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "beacon_session_not_found", request_id: req.requestId });
    }
    if (req.body.command || req.body.shell || req.body.raw_command) {
      return res.status(400).json({ error: "raw_command_rejected", allowed_task_types: Object.keys(safeBeaconTasks), request_id: req.requestId });
    }
    const taskType = String(req.body.task_type || "").trim();
    const taskDefinition = safeBeaconTasks[taskType];
    if (!taskDefinition) {
      return res.status(400).json({ error: "unsupported_task_type", allowed_task_types: Object.keys(safeBeaconTasks), request_id: req.requestId });
    }
    const result = taskDefinition.result(req.body || {});
    if (!result) {
      return res.status(400).json({ error: "unsupported_task_profile", allowed_command_profiles: ["whoami-profile", "hostname-profile", "service-health-profile"], request_id: req.requestId });
    }
    const task = {
      task_id: stableId("task", [session.session_id, taskType, req.requestId]),
      session_id: session.session_id,
      task_type: taskType,
      label: taskDefinition.label,
      status: "simulated_completed",
      result,
      created_at: new Date().toISOString(),
      controls: stage5Controls({ raw_command_allowed: false, synthetic_result_only: true }),
    };
    session.tasks.push(task);
    recordAdversaryEvent(req, "adversary.beacon.task_polled", {
      severity: taskDefinition.severity,
      mitre: taskDefinition.mitre,
      beacon_session_id: session.session_id,
      task_id: task.task_id,
      task_type: task.task_type,
    });
    recordAdversaryEvent(req, "adversary.beacon.task_result", {
      severity: taskDefinition.severity,
      mitre: taskDefinition.mitre,
      beacon_session_id: session.session_id,
      task_id: task.task_id,
      task_type: task.task_type,
      result_summary: Object.keys(result),
      controls: { raw_command_allowed: false, synthetic_result_only: true },
    });
    return res.status(202).json({ task, request_id: req.requestId });
  });
}

function registerRedirectorRoutes() {
  const guard = requireRoles(stage5GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/profiles", "/api/routes", "/api/routes/simulate"] });
  });

  app.get("/api/profiles", guard, (req, res) => {
    res.json({ traffic_profiles: trafficProfiles, request_id: req.requestId });
  });

  app.get("/api/routes", guard, (req, res) => {
    res.json({ routes: redirectorRoutes, request_id: req.requestId });
  });

  app.post("/api/routes/simulate", guard, (req, res) => {
    const profile = findById(trafficProfiles, req.body.profile_id || "business-hours-low-noise");
    const route = findById(redirectorRoutes, req.body.route_id || "edge-to-beacon");
    if (!profile || !route) {
      return res.status(400).json({
        error: "unsupported_redirector_profile_or_route",
        allowed_profiles: trafficProfiles.map((item) => item.id),
        allowed_routes: redirectorRoutes.map((item) => item.id),
        request_id: req.requestId,
      });
    }
    const routeEvent = {
      route_event_id: stableId("route", [profile.id, route.id, req.requestId]),
      profile_id: profile.id,
      route_id: route.id,
      chain: route.chain,
      target: route.target,
      listener: profile.listener,
      https_listener_simulated: true,
      rotating_route: profile.route_rotation,
      jitter_percent: profile.jitter_percent,
      external_callback: false,
      controls: stage5Controls({ proxy_routing_only: true }),
    };
    recordAdversaryEvent(req, "adversary.redirector.route_selected", {
      severity: "medium",
      mitre: ["T1090", "T1071.001"],
      ...routeEvent,
    });
    recordAdversaryEvent(req, "adversary.redirector.traffic_shaped", {
      severity: profile.opsec.delayed_execution ? "high" : "medium",
      mitre: ["T1090", "T1029", "T1071.001"],
      ...routeEvent,
      opsec: profile.opsec,
    });
    return res.status(202).json({ route_event: routeEvent, request_id: req.requestId });
  });
}

function registerPivotRoutes() {
  const guard = requireRoles(stage5GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/paths", "/api/pivots/simulate"] });
  });

  app.get("/api/paths", guard, (req, res) => {
    res.json({ paths: pivotPaths, request_id: req.requestId });
  });

  app.post("/api/pivots/simulate", guard, (req, res) => {
    const pathItem = findById(pivotPaths, req.body.path_id || "delegated-token-pivot");
    if (!pathItem) {
      return res.status(400).json({ error: "unsupported_pivot_path", allowed_paths: pivotPaths.map((item) => item.id), request_id: req.requestId });
    }
    const pivot = {
      pivot_id: stableId("pivot", [pathItem.id, req.requestId, Date.now().toString()]),
      path_id: pathItem.id,
      source_zone: pathItem.source_zone,
      target_zone: pathItem.target_zone,
      route: pathItem.route,
      trust_boundary_crossings: pathItem.trust_boundary_crossings,
      status: "simulated_completed",
      controls: stage5Controls({ real_network_change: false, exploit_execution: false }),
    };
    recordAdversaryEvent(req, "adversary.pivot.simulated", {
      severity: pathItem.severity,
      mitre: pathItem.mitre,
      pivot_id: pivot.pivot_id,
      path_id: pathItem.id,
      route: pathItem.route,
      trust_boundary_crossings: pathItem.trust_boundary_crossings,
      controls: { real_network_change: false, exploit_execution: false },
    });
    recordAdversaryEvent(req, "adversary.lateral_movement.simulated", {
      severity: pathItem.severity,
      mitre: pathItem.mitre,
      pivot_id: pivot.pivot_id,
      path_id: pathItem.id,
      source_zone: pathItem.source_zone,
      target_zone: pathItem.target_zone,
      controls: { real_network_change: false, exploit_execution: false },
    });
    return res.status(202).json({ pivot, request_id: req.requestId });
  });
}

function registerPersistenceRoutes() {
  const guard = requireRoles(stage5GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/mechanisms", "/api/register", "/api/active", "/api/cleanup"] });
  });

  app.get("/api/mechanisms", guard, (req, res) => {
    res.json({ mechanisms: persistenceMechanisms, request_id: req.requestId });
  });

  app.get("/api/active", guard, (req, res) => {
    res.json({ active: persistenceRecords.filter((item) => item.status === "simulated_registered"), request_id: req.requestId });
  });

  app.post("/api/register", guard, (req, res) => {
    const mechanism = findById(persistenceMechanisms, req.body.mechanism_id || "scheduled-task-sim");
    if (!mechanism) {
      return res.status(400).json({ error: "unsupported_persistence_mechanism", allowed_mechanisms: persistenceMechanisms.map((item) => item.id), request_id: req.requestId });
    }
    const record = {
      persistence_id: stableId("persist", [mechanism.id, req.requestId, Date.now().toString()]),
      mechanism_id: mechanism.id,
      name: mechanism.name,
      target_scope: String(req.body.target_scope || "developer-workstation-sim").slice(0, 120),
      operator: principalLabel(req),
      status: "simulated_registered",
      cleanup_required: true,
      registered_at: new Date().toISOString(),
      controls: stage5Controls({ real_system_change: false, cleanup_supported: true }),
    };
    persistenceRecords.push(record);
    recordAdversaryEvent(req, "adversary.persistence.registered", {
      severity: "high",
      mitre: mechanism.mitre,
      persistence_id: record.persistence_id,
      mechanism_id: mechanism.id,
      target_scope: record.target_scope,
      controls: { real_system_change: false, cleanup_supported: true },
    });
    return res.status(201).json({ persistence: record, request_id: req.requestId });
  });

  app.post("/api/cleanup", guard, (req, res) => {
    const targetId = req.body.persistence_id;
    const cleaned = [];
    for (const record of persistenceRecords) {
      if (record.status !== "simulated_registered") {
        continue;
      }
      if (targetId && record.persistence_id !== targetId) {
        continue;
      }
      record.status = "simulated_cleaned";
      record.cleaned_at = new Date().toISOString();
      record.cleanup_required = false;
      cleaned.push(record);
      recordAdversaryEvent(req, "adversary.persistence.cleaned", {
        severity: "low",
        mitre: [],
        persistence_id: record.persistence_id,
        mechanism_id: record.mechanism_id,
        controls: { real_system_change: false, cleanup_supported: true },
      });
    }
    return res.json({ cleaned, remaining_active: persistenceRecords.filter((item) => item.status === "simulated_registered").length, request_id: req.requestId });
  });
}

const stage6GuardRoles = [
  "admin",
  "soc_analyst",
  "detection_engineer",
  "threat_hunter",
  "incident_responder",
  "red_team_operator",
  "service_intelligence",
  "service_digital_twin",
  "service_graph",
  "service_orchestrator",
  "service_hunting",
  "service_coverage",
  "service_chaos",
  "service_observability",
  "service_soc",
];

const digitalTwinActivityProfiles = [
  {
    id: "jakarta-business-day",
    name: "Jakarta business day baseline",
    timezone: "Asia/Jakarta",
    business_hours: [8, 18],
    off_hours_rate: 0.03,
    weights: {
      employee_login: 18,
      developer_commit: 8,
      cicd_pipeline_run: 7,
      cron_activity: 10,
      hr_workflow: 8,
      finance_workflow: 8,
      internal_chat_message: 17,
      ticket_activity: 12,
      service_communication: 12,
    },
  },
  {
    id: "engineering-release-window",
    name: "Engineering release window",
    timezone: "Asia/Jakarta",
    business_hours: [9, 22],
    off_hours_rate: 0.08,
    weights: {
      employee_login: 10,
      developer_commit: 18,
      cicd_pipeline_run: 17,
      cron_activity: 8,
      hr_workflow: 3,
      finance_workflow: 4,
      internal_chat_message: 14,
      ticket_activity: 12,
      service_communication: 14,
    },
  },
  {
    id: "finance-close",
    name: "Finance close activity",
    timezone: "Asia/Jakarta",
    business_hours: [7, 20],
    off_hours_rate: 0.05,
    weights: {
      employee_login: 14,
      developer_commit: 4,
      cicd_pipeline_run: 4,
      cron_activity: 9,
      hr_workflow: 6,
      finance_workflow: 24,
      internal_chat_message: 14,
      ticket_activity: 11,
      service_communication: 14,
    },
  },
  {
    id: "off-hours-anomaly",
    name: "Off-hours anomaly training profile",
    timezone: "Asia/Jakarta",
    business_hours: [0, 6],
    off_hours_rate: 0.45,
    weights: {
      employee_login: 12,
      developer_commit: 10,
      cicd_pipeline_run: 10,
      cron_activity: 16,
      hr_workflow: 4,
      finance_workflow: 10,
      internal_chat_message: 8,
      ticket_activity: 8,
      service_communication: 22,
    },
  },
];

const digitalTwinActivities = [];
const stage6CampaignRuns = [];
const huntWorkspaceNotes = [];
const chaosInjections = [];
const replaySnapshots = [];

const digitalTwinActivityCatalog = {
  employee_login: { service: "auth-service", severity: "low", mitre: ["T1078"], description: "Employee login telemetry" },
  developer_commit: { service: "git-sim", severity: "low", mitre: ["T1105"], description: "Developer commit metadata" },
  cicd_pipeline_run: { service: "ci-sim", severity: "low", mitre: ["T1053"], description: "Synthetic CI pipeline run" },
  cron_activity: { service: "observability-api", severity: "low", mitre: ["T1053"], description: "Scheduled enterprise job" },
  hr_workflow: { service: "hr-portal", severity: "low", mitre: [], description: "Synthetic HR workflow" },
  finance_workflow: { service: "finance-portal", severity: "low", mitre: [], description: "Synthetic finance workflow" },
  internal_chat_message: { service: "employee-portal", severity: "low", mitre: [], description: "Synthetic chat/message traffic" },
  ticket_activity: { service: "developer-dashboard", severity: "low", mitre: [], description: "Synthetic ticket update" },
  service_communication: { service: "internal-api", severity: "low", mitre: ["T1021"], description: "Periodic service communication" },
};

const stage6CampaignTemplates = [
  {
    id: "adaptive-token-to-secrets",
    name: "Adaptive token-to-secrets campaign",
    stealth_profiles: ["balanced", "low-and-slow", "high-visibility-training"],
    phases: [
      { id: "reconnaissance", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1590", "T1046"], service: "service-discovery" },
      { id: "token_abuse", event: "stage6.campaign.phase_completed", severity: "high", mitre: ["T1550.001", "T1606"], service: "auth-service" },
      { id: "secrets_abuse", event: "stage6.campaign.phase_completed", severity: "critical", mitre: ["T1552", "T1528"], service: "secrets-broker" },
      { id: "stealth", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1029"], service: "redirector-sim" },
      { id: "exfiltration_simulation", event: "stage6.campaign.phase_completed", severity: "high", mitre: ["T1041", "T1119"], service: "artifact-store" },
    ],
  },
  {
    id: "cicd-pivot-chaos-aware",
    name: "CI/CD pivot with chaos-aware timing",
    stealth_profiles: ["operator-paced", "release-window", "low-and-slow"],
    phases: [
      { id: "reconnaissance", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1590"], service: "service-discovery" },
      { id: "cicd_compromise", event: "stage6.campaign.phase_completed", severity: "high", mitre: ["T1195.002", "T1078"], service: "ci-sim" },
      { id: "lateral_movement", event: "stage6.campaign.phase_completed", severity: "high", mitre: ["T1021", "T1078"], service: "pivot-sim" },
      { id: "persistence_simulation", event: "stage6.campaign.phase_completed", severity: "high", mitre: ["T1053.005"], service: "persistence-sim" },
      { id: "detection_aware_pause", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1029"], service: "coverage-intel" },
    ],
  },
  {
    id: "recon-to-coverage-gap",
    name: "Reconnaissance to coverage gap campaign",
    stealth_profiles: ["high-visibility-training", "balanced"],
    phases: [
      { id: "reconnaissance", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1590", "T1046"], service: "service-discovery" },
      { id: "attack_graph_review", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1069"], service: "attack-graph" },
      { id: "coverage_gap_selection", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1082"], service: "coverage-intel" },
      { id: "hunt_validation", event: "stage6.campaign.phase_completed", severity: "medium", mitre: ["T1087"], service: "threat-hunting" },
    ],
  },
];

const huntPacks = [
  { id: "identity-abuse", name: "Identity abuse hunt pack", techniques: ["T1550.001", "T1606", "T1078"], pivots: ["principal", "token_audience", "service_account"] },
  { id: "devops-supply-chain", name: "CI/CD and supply-chain hunt pack", techniques: ["T1195.002", "T1552", "T1078"], pivots: ["repository", "run_id", "pipeline_token"] },
  { id: "low-noise-operations", name: "Low-noise operation hunt pack", techniques: ["T1029", "T1071.001", "T1090"], pivots: ["profile_id", "jitter_percent", "route_id"] },
  { id: "persistence-simulation", name: "Persistence simulation hunt pack", techniques: ["T1053.005", "T1547", "T1543"], pivots: ["persistence_id", "mechanism_id", "cleanup_required"] },
];

const chaosScenarios = [
  { id: "telemetry-drop-sim", event: "stage6.chaos.telemetry_drop_simulated", name: "Temporary telemetry drop", severity: "high", mitre: ["T1562.008"], reversible: true },
  { id: "auth-desync-sim", event: "stage6.chaos.auth_desync_simulated", name: "Auth desync", severity: "high", mitre: ["T1550.001"], reversible: true },
  { id: "secret-exposure-sim", event: "stage6.chaos.secret_exposure_simulated", name: "Secret exposure event", severity: "critical", mitre: ["T1552"], reversible: true },
  { id: "rbac-misconfig-sim", event: "stage6.chaos.rbac_misconfiguration_simulated", name: "RBAC misconfiguration", severity: "high", mitre: ["T1069"], reversible: true },
  { id: "expired-token-sim", event: "stage6.chaos.expired_token_simulated", name: "Expired token event", severity: "medium", mitre: ["T1550.001"], reversible: true },
  { id: "logging-degradation-sim", event: "stage6.chaos.logging_degradation_simulated", name: "Logging degradation", severity: "high", mitre: ["T1562.008"], reversible: true },
  { id: "cicd-instability-sim", event: "stage6.chaos.cicd_instability_simulated", name: "CI/CD instability", severity: "medium", mitre: ["T1195.002"], reversible: true },
  { id: "partial-outage-sim", event: "stage6.chaos.partial_outage_simulated", name: "Partial service outage", severity: "medium", mitre: ["T1499"], reversible: true },
];

function stage6Controls(extra = {}) {
  return {
    isolated_lab_only: true,
    synthetic_only: true,
    destructive_actions: false,
    command_execution: false,
    exploit_execution: false,
    external_callbacks: false,
    public_targets: false,
    real_persistence: false,
    reversible: true,
    replayable: true,
    telemetry_observable: true,
    ...extra,
  };
}

function recordStage6Event(req, event, extra = {}) {
  const { controls, ...details } = extra;
  const payload = {
    event,
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    request_id: req.requestId,
    principal: principalLabel(req),
    lab_stage: "stage6-enterprise-intelligence-digital-twin",
    severity: details.severity || "medium",
    mitre: details.mitre || [],
    safe_simulation: true,
    simulation_scope: "isolated-lab",
    controls: stage6Controls(controls || {}),
    ...details,
  };
  log("INFO", "Stage 6 enterprise intelligence simulation event recorded.", payload);
  emitTelemetry(payload);
  return payload;
}

function weightedActivityType(weights) {
  const entries = Object.entries(weights || {});
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight || 0), 0);
  let cursor = crypto.randomInt(Math.max(total, 1));
  for (const [name, weight] of entries) {
    cursor -= Number(weight || 0);
    if (cursor < 0) {
      return name;
    }
  }
  return entries[0]?.[0] || "service_communication";
}

function timezoneParts(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const result = {};
  parts.forEach((part) => {
    result[part.type] = part.value;
  });
  const hour = Number(result.hour === "24" ? 0 : result.hour);
  return { weekday: result.weekday, hour, minute: Number(result.minute || 0) };
}

function generatedLocalHour(profile, includeOffHours, index) {
  const [start, end] = profile.business_hours;
  const shouldUseOffHours = includeOffHours && (index === 0 || crypto.randomInt(100) < Math.round(profile.off_hours_rate * 100));
  if (shouldUseOffHours) {
    return [1, 3, 22, 23][crypto.randomInt(4)];
  }
  return start + crypto.randomInt(Math.max(end - start, 1));
}

function generateDigitalTwinActivity(req, profile, count, timezone, includeOffHours) {
  const generated = [];
  for (let index = 0; index < count; index += 1) {
    const activityType = weightedActivityType(profile.weights);
    const catalog = digitalTwinActivityCatalog[activityType] || digitalTwinActivityCatalog.service_communication;
    const scheduledAt = new Date(Date.now() + index * 60_000);
    const local = timezoneParts(scheduledAt, timezone);
    const localHour = generatedLocalHour(profile, includeOffHours, index);
    const offHours = localHour < 7 || localHour >= 20;
    const actor = directoryUsers[index % directoryUsers.length];
    const activity = {
      activity_id: stableId("dtwin", [profile.id, req.requestId, String(index)]),
      profile_id: profile.id,
      activity_type: activityType,
      service: catalog.service,
      actor: actor.username,
      department: actor.department,
      timezone,
      generated_at: new Date().toISOString(),
      scheduled_at: scheduledAt.toISOString(),
      local_weekday: local.weekday,
      local_hour: localHour,
      local_minute: local.minute,
      off_hours: offHours,
      synthetic_background_activity: true,
      controls: stage6Controls({ background_activity: true }),
    };
    digitalTwinActivities.push(activity);
    generated.push(activity);
    recordStage6Event(req, `digital_twin.${activityType}`, {
      severity: catalog.severity,
      mitre: catalog.mitre,
      synthetic_background_activity: true,
      activity_id: activity.activity_id,
      activity_type: activity.activity_type,
      simulated_service: activity.service,
      actor: activity.actor,
      department: activity.department,
      timezone,
      local_hour: localHour,
      off_hours: offHours,
      controls: { background_activity: true },
    });
    if (offHours) {
      recordStage6Event(req, "digital_twin.off_hours_activity", {
        severity: "medium",
        mitre: ["T1078", "T1029"],
        synthetic_background_activity: true,
        activity_id: activity.activity_id,
        activity_type: activity.activity_type,
        simulated_service: activity.service,
        actor: activity.actor,
        timezone,
        local_hour: localHour,
        controls: { background_activity: true, anomaly_training_marker: true },
      });
    }
  }
  while (digitalTwinActivities.length > 250) {
    digitalTwinActivities.shift();
  }
  return generated;
}

function addGraphNode(nodes, id, type, label, extra = {}) {
  if (!nodes.has(id)) {
    nodes.set(id, { id, type, label, ...extra });
  }
}

function addGraphEdge(edges, from, to, relationship, extra = {}) {
  edges.push({ id: stableId("edge", [from, to, relationship, extra.source || "static"]), from, to, relationship, ...extra });
}

function buildAttackGraph(events = []) {
  const nodes = new Map();
  const edges = [];
  directoryUsers.forEach((user) => addGraphNode(nodes, `user:${user.username}`, "identity", user.username, { roles: user.roles, department: user.department }));
  serviceCatalog.forEach((service) => addGraphNode(nodes, `service:${service.service}`, "service", service.service, { trust: service.trust, privileged: service.privileged }));
  internalDnsRecords.forEach((record) => addGraphNode(nodes, `dns:${record.name}`, "dns", record.name, { zone: record.zone }));
  repositories.forEach((repo) => addGraphNode(nodes, `repo:${repo.name}`, "repository", repo.name, { owner: repo.owner }));
  vaultPolicies.forEach((policy) => addGraphNode(nodes, `policy:${policy.name}`, "vault-policy", policy.name, { paths: policy.paths }));

  directoryUsers.forEach((user) => {
    if (user.manager) {
      addGraphEdge(edges, `user:${user.username}`, `user:${user.manager}`, "reports_to", { source: "directory" });
    }
    user.roles.forEach((role) => addGraphEdge(edges, `user:${user.username}`, `role:${role}`, "has_role", { source: "directory" }));
    addGraphNode(nodes, `role:${user.roles[0]}`, "role", user.roles[0]);
  });
  serviceCatalog.forEach((service) => {
    addGraphEdge(edges, "service:enterprise-gateway", `service:${service.service}`, service.exposed_via_gateway ? "routes_to" : "internal_only", { source: "gateway", privileged: service.privileged });
  });
  internalDnsRecords.forEach((record) => addGraphEdge(edges, `dns:${record.name}`, `service:${record.service}`, "resolves_to", { source: "dns", zone: record.zone }));
  repositories.forEach((repo) => {
    addGraphEdge(edges, `repo:${repo.name}`, "service:ci-sim", "triggers_pipeline", { source: "devops", branch: repo.default_branch });
    addGraphEdge(edges, "service:ci-sim", "service:artifact-store", "publishes_artifact", { source: "devops" });
  });
  vaultPolicies.forEach((policy) => {
    addGraphEdge(edges, `policy:${policy.name}`, "service:secrets-broker", "authorizes_secret_path", { source: "vault-policy", principals: policy.principals });
  });
  pivotPaths.forEach((pathItem) => {
    pathItem.route.forEach((service, index) => {
      addGraphNode(nodes, `service:${service}`, "service", service, { inferred_from_pivot: true });
      if (index > 0) {
        addGraphEdge(edges, `service:${pathItem.route[index - 1]}`, `service:${service}`, "simulated_pivot_path", {
          source: "stage5-pivot",
          path_id: pathItem.id,
          severity: pathItem.severity,
          mitre: pathItem.mitre,
        });
      }
    });
  });

  events.map(normalizeTelemetryEvent).forEach((event) => {
    const principal = event.principal || "unknown";
    const service = event.source_service || "unknown";
    addGraphNode(nodes, `principal:${principal}`, "observed-principal", principal, { observed: true });
    addGraphNode(nodes, `service:${service}`, "service", service, { observed: true });
    addGraphEdge(edges, `principal:${principal}`, `service:${service}`, "observed_activity", {
      source: "telemetry",
      event_name: event.event_name,
      event_id: event.event_id,
      severity: event.severity,
      attack_simulation: event.attack_simulation,
      replay_id: event.replay_id,
    });
  });

  return {
    generated_at: new Date().toISOString(),
    nodes: [...nodes.values()],
    edges,
    summary: {
      nodes: nodes.size,
      edges: edges.length,
      privileged_services: [...nodes.values()].filter((node) => node.privileged).length,
      telemetry_edges: edges.filter((edge) => edge.source === "telemetry").length,
    },
  };
}

function discoverPrivilegePaths(graph) {
  const privileged = new Set(graph.nodes.filter((node) => node.privileged || ["service:secrets-broker", "service:ci-sim", "service:internal-admin-dashboard"].includes(node.id)).map((node) => node.id));
  return graph.edges
    .filter((edge) => privileged.has(edge.to) || edge.relationship === "simulated_pivot_path")
    .slice(0, 25)
    .map((edge) => ({
      path_id: stableId("privpath", [edge.from, edge.to, edge.relationship]),
      from: edge.from,
      to: edge.to,
      relationship: edge.relationship,
      severity: edge.severity || (privileged.has(edge.to) ? "high" : "medium"),
      mitre: edge.mitre || ["T1078"],
    }));
}

function calculateBlastRadius(graph, startId) {
  const adjacency = new Map();
  graph.edges.forEach((edge) => {
    const list = adjacency.get(edge.from) || [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  });
  const visited = new Set([startId]);
  const queue = [startId];
  while (queue.length && visited.size < 50) {
    const current = queue.shift();
    for (const next of adjacency.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return {
    start: startId,
    reachable_nodes: [...visited],
    reachable_count: visited.size,
    risk_score: Math.min(100, visited.size * 7),
  };
}

function buildCoverageIntelligence(events, alerts) {
  const rules = activeDetectionRules();
  const techniques = new Map();
  const tactics = new Map();
  rules.forEach((rule) => {
    rule.mitre.forEach((technique) => {
      const item = techniques.get(technique) || { technique, rule_count: 0, alert_count: 0, severities: {} };
      item.rule_count += 1;
      item.severities[rule.severity] = (item.severities[rule.severity] || 0) + 1;
      techniques.set(technique, item);
    });
    rule.tactics.forEach((tactic) => {
      tactics.set(tactic, (tactics.get(tactic) || 0) + 1);
    });
  });
  alerts.forEach((alert) => {
    alert.mitre.forEach((technique) => {
      const item = techniques.get(technique) || { technique, rule_count: 0, alert_count: 0, severities: {} };
      item.alert_count += 1;
      techniques.set(technique, item);
    });
  });
  const serviceCounts = {};
  events.forEach((event) => {
    const service = event.service || event.caller || "unknown";
    serviceCounts[service] = (serviceCounts[service] || 0) + 1;
  });
  const targetNames = serviceTargets().map((target) => target.name);
  const blindspots = targetNames
    .filter((name) => !serviceCounts[name])
    .map((service) => ({ service, issue: "no_recent_telemetry_in_window", recommendation: "Generate baseline traffic or verify telemetry forwarding." }));
  return {
    generated_at: new Date().toISOString(),
    attack_heatmap: [...techniques.values()].sort((left, right) => right.rule_count + right.alert_count - (left.rule_count + left.alert_count)),
    tactic_coverage: [...tactics.entries()].map(([tactic, rule_count]) => ({ tactic, rule_count })),
    blindspots,
    service_visibility: Object.entries(serviceCounts).map(([service, event_count]) => ({ service, event_count, score: Math.min(100, event_count * 5) })),
    summary: {
      rules: rules.length,
      alerts: alerts.length,
      services_with_telemetry: Object.keys(serviceCounts).length,
      blindspots: blindspots.length,
      visibility_score: Math.max(0, Math.min(100, Math.round(((targetNames.length - blindspots.length) / Math.max(targetNames.length, 1)) * 100))),
    },
  };
}

function registerDigitalTwinRoutes() {
  const guard = requireRoles(stage6GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/profiles", "/api/activity/generate", "/api/activity/recent"] });
  });

  app.get("/api/profiles", guard, (req, res) => {
    res.json({ profiles: digitalTwinActivityProfiles, request_id: req.requestId });
  });

  app.post("/api/activity/generate", guard, (req, res) => {
    const profile = findById(digitalTwinActivityProfiles, req.body.profile_id || "jakarta-business-day");
    if (!profile) {
      return res.status(400).json({ error: "unsupported_activity_profile", allowed_profiles: digitalTwinActivityProfiles.map((item) => item.id), request_id: req.requestId });
    }
    const count = clampNumber(req.body.count, 12, 1, 50);
    const timezone = String(req.body.timezone || profile.timezone || "Asia/Jakarta");
    const includeOffHours = req.body.include_off_hours !== false;
    const generated = generateDigitalTwinActivity(req, profile, count, timezone, includeOffHours);
    return res.status(202).json({
      profile_id: profile.id,
      timezone,
      generated,
      controls: stage6Controls({ background_activity: true }),
      request_id: req.requestId,
    });
  });

  app.get("/api/activity/recent", guard, (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    res.json({ activity: digitalTwinActivities.slice(-limit).reverse(), request_id: req.requestId });
  });
}

function registerAttackGraphRoutes() {
  const guard = requireRoles(stage6GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/graph", "/api/paths/privilege-escalation", "/api/blast-radius", "/api/trust-boundaries"] });
  });

  app.get("/api/graph", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.query.limit || 700));
      const graph = buildAttackGraph(events);
      const privilegePaths = discoverPrivilegePaths(graph);
      recordStage6Event(req, "stage6.attack_graph.generated", {
        severity: privilegePaths.some((item) => item.severity === "high" || item.severity === "critical") ? "high" : "medium",
        mitre: ["T1069", "T1087", "T1021"],
        node_count: graph.summary.nodes,
        edge_count: graph.summary.edges,
        privilege_paths: privilegePaths.length,
      });
      res.json({ graph, privilege_paths: privilegePaths, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/paths/privilege-escalation", guard, async (req, res, next) => {
    try {
      const graph = buildAttackGraph(await fetchLogEvents(Number(req.query.limit || 700)));
      const paths = discoverPrivilegePaths(graph);
      recordStage6Event(req, "stage6.attack_graph.privilege_path_analysis", {
        severity: paths.length ? "high" : "low",
        mitre: ["T1069", "T1078", "T1021"],
        path_count: paths.length,
      });
      res.json({ paths, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/blast-radius", guard, async (req, res, next) => {
    try {
      const graph = buildAttackGraph(await fetchLogEvents(Number(req.query.limit || 700)));
      const service = String(req.query.service || "secrets-broker");
      const blast_radius = calculateBlastRadius(graph, service.startsWith("service:") ? service : `service:${service}`);
      res.json({ blast_radius, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/trust-boundaries", guard, (req, res) => {
    res.json({
      trust_boundaries: [
        { from: "edge", to: "identity", controls: ["gateway-auth-request", "JWT validation"] },
        { from: "enterprise", to: "identity", controls: ["service account JWT", "role checks"] },
        { from: "devops", to: "enterprise", controls: ["pipeline token policy", "artifact provenance"] },
        { from: "adversary-operations", to: "observability", controls: ["safe simulation tags", "central logging"] },
        { from: "intelligence", to: "observability", controls: ["read-only analysis", "service-account access"] },
      ],
      request_id: req.requestId,
    });
  });
}

function registerCampaignOrchestratorRoutes() {
  const guard = requireRoles(stage6GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/templates", "/api/campaigns/run", "/api/campaigns/runs"] });
  });

  app.get("/api/templates", guard, (req, res) => {
    res.json({ templates: stage6CampaignTemplates, request_id: req.requestId });
  });

  app.post("/api/campaigns/run", guard, (req, res) => {
    const template = findById(stage6CampaignTemplates, req.body.template_id || "adaptive-token-to-secrets");
    if (!template) {
      return res.status(400).json({ error: "unsupported_campaign_template", allowed_templates: stage6CampaignTemplates.map((item) => item.id), request_id: req.requestId });
    }
    const stealthProfile = String(req.body.stealth_profile || template.stealth_profiles[0]);
    if (!template.stealth_profiles.includes(stealthProfile)) {
      return res.status(400).json({ error: "unsupported_stealth_profile", allowed_profiles: template.stealth_profiles, request_id: req.requestId });
    }
    const randomize = Boolean(req.body.randomize);
    const phases = [...template.phases];
    if (randomize) {
      phases.sort((left, right) => stableId("sort", [req.requestId, left.id]).localeCompare(stableId("sort", [req.requestId, right.id])));
    }
    const runId = stableId("stage6run", [template.id, req.requestId, Date.now().toString()]);
    recordStage6Event(req, "stage6.campaign.started", {
      severity: "medium",
      mitre: [...new Set(template.phases.flatMap((phase) => phase.mitre))],
      campaign_run_id: runId,
      template_id: template.id,
      stealth_profile: stealthProfile,
      randomize,
      controls: { autonomous_decisioning: "synthetic-rule-based", operator_configurable: true },
    });
    const emitted = phases.map((phase, index) =>
      recordStage6Event(req, phase.event, {
        severity: phase.severity,
        mitre: phase.mitre,
        campaign_run_id: runId,
        template_id: template.id,
        phase_id: phase.id,
        phase_sequence: index + 1,
        simulated_service: phase.service,
        stealth_profile: stealthProfile,
        detection_aware: true,
        adaptive_timing_simulation: true,
        exfiltration_real_data: false,
        controls: { autonomous_decisioning: "synthetic-rule-based", real_data_exfiltration: false },
      }),
    );
    const completed = recordStage6Event(req, "stage6.campaign.completed", {
      severity: maxSeverity(phases.map((phase) => phase.severity)),
      mitre: [...new Set(phases.flatMap((phase) => phase.mitre))],
      campaign_run_id: runId,
      template_id: template.id,
      emitted_events: emitted.length + 2,
      replay_export_available: true,
      controls: { autonomous_decisioning: "synthetic-rule-based", real_data_exfiltration: false },
    });
    const run = {
      run_id: runId,
      template_id: template.id,
      status: "completed",
      operator: principalLabel(req),
      stealth_profile: stealthProfile,
      phases: phases.map((phase, index) => ({ ...phase, sequence: index + 1 })),
      emitted_events: [...emitted, completed].map((event) => ({ event_id: event.event_id, event: event.event, severity: event.severity })),
      controls: stage6Controls({ autonomous_decisioning: "synthetic-rule-based", real_data_exfiltration: false }),
      created_at: new Date().toISOString(),
    };
    stage6CampaignRuns.push(run);
    res.status(202).json({ campaign_run: run, request_id: req.requestId });
  });

  app.get("/api/campaigns/runs", guard, (req, res) => {
    res.json({ runs: stage6CampaignRuns.slice(-50).reverse(), request_id: req.requestId });
  });

  app.get("/api/campaigns/:runId/replay-export", guard, (req, res) => {
    const run = stage6CampaignRuns.find((item) => item.run_id === req.params.runId);
    if (!run) {
      return res.status(404).json({ error: "campaign_run_not_found", request_id: req.requestId });
    }
    return res.json({ replay_export: run, deterministic: true, request_id: req.requestId });
  });
}

function registerThreatHuntingRoutes() {
  const guard = requireRoles(stage6GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/hunt-packs", "/api/query", "/api/timeline/suspicious", "/api/workspace"] });
  });

  app.get("/api/hunt-packs", guard, (req, res) => {
    res.json({ hunt_packs: huntPacks, request_id: req.requestId });
  });

  app.post("/api/query", guard, async (req, res, next) => {
    try {
      const queryType = String(req.body.query_type || "attack_pattern");
      const indicator = String(req.body.indicator || "T1550.001");
      const events = (await fetchLogEvents(Number(req.body.limit || 800))).map(normalizeTelemetryEvent);
      let matches = [];
      if (queryType === "ioc") {
        matches = events.filter((event) => JSON.stringify(event.raw).includes(indicator));
      } else if (queryType === "anomaly") {
        matches = events.filter((event) => event.event_name.includes("off_hours") || event.severity === "critical");
      } else if (queryType === "identity_abuse") {
        matches = events.filter((event) => event.mitre.includes("T1550.001") || event.mitre.includes("T1078"));
      } else if (queryType === "timeline") {
        matches = events.filter((event) => event.replay_id || event.raw.operation_run_id || event.raw.campaign_run_id);
      } else {
        matches = events.filter((event) => event.mitre.includes(indicator) || event.event_name.includes(indicator.toLowerCase()));
      }
      const hunt = {
        hunt_id: stableId("hunt", [queryType, indicator, req.requestId]),
        query_type: queryType,
        indicator,
        matches: matches.slice(0, 50),
        match_count: matches.length,
        generated_at: new Date().toISOString(),
      };
      recordStage6Event(req, "stage6.hunt.query_executed", {
        severity: matches.length ? "medium" : "low",
        mitre: queryType === "identity_abuse" ? ["T1550.001", "T1078"] : ["T1087"],
        hunt_id: hunt.hunt_id,
        query_type: queryType,
        indicator,
        match_count: matches.length,
      });
      res.json({ hunt, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/timeline/suspicious", guard, async (req, res, next) => {
    try {
      const events = (await fetchLogEvents(Number(req.query.limit || 800))).map(normalizeTelemetryEvent);
      const suspicious = events
        .filter((event) => event.attack_simulation || event.severity === "high" || event.severity === "critical" || event.event_name.includes("off_hours"))
        .slice(0, 100);
      res.json({ suspicious_timeline: suspicious, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/workspace", guard, (req, res) => {
    res.json({ notes: huntWorkspaceNotes.slice(-50).reverse(), roles: ["soc_analyst", "threat_hunter", "detection_engineer", "incident_responder"], request_id: req.requestId });
  });

  app.post("/api/workspace/notes", guard, (req, res) => {
    const note = {
      note_id: stableId("huntnote", [req.requestId, Date.now().toString()]),
      author: principalLabel(req),
      title: String(req.body.title || "Stage 6 hunt note").slice(0, 120),
      note: String(req.body.note || "Threat hunting workspace update").slice(0, 1000),
      created_at: new Date().toISOString(),
    };
    huntWorkspaceNotes.push(note);
    recordStage6Event(req, "stage6.hunt.workspace_updated", { severity: "low", mitre: [], note_id: note.note_id });
    res.status(201).json({ note, request_id: req.requestId });
  });
}

function registerCoverageIntelRoutes() {
  const guard = requireRoles(stage6GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/attack-heatmap", "/api/matrix", "/api/blindspots", "/api/executive-report"] });
  });

  async function coverage(req) {
    const events = await fetchLogEvents(Number(req.query.limit || req.body?.limit || 900));
    const alerts = detectAlerts(events);
    return buildCoverageIntelligence(events, alerts);
  }

  app.get("/api/attack-heatmap", guard, async (req, res, next) => {
    try {
      const report = await coverage(req);
      recordStage6Event(req, "stage6.coverage.analysis_generated", {
        severity: "medium",
        mitre: ["T1082"],
        rules: report.summary.rules,
        visibility_score: report.summary.visibility_score,
      });
      res.json({ heatmap: report.attack_heatmap, summary: report.summary, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/matrix", guard, async (req, res, next) => {
    try {
      const report = await coverage(req);
      res.json({ matrix: report.tactic_coverage, attack_heatmap: report.attack_heatmap, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/blindspots", guard, async (req, res, next) => {
    try {
      const report = await coverage(req);
      recordStage6Event(req, "stage6.coverage.blindspot_identified", {
        severity: report.blindspots.length ? "medium" : "low",
        mitre: ["T1082"],
        blindspot_count: report.blindspots.length,
      });
      res.json({ blindspots: report.blindspots, service_visibility: report.service_visibility, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/visibility-score", guard, async (req, res, next) => {
    try {
      const report = await coverage(req);
      res.json({ visibility_score: report.summary.visibility_score, summary: report.summary, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/executive-report", guard, async (req, res, next) => {
    try {
      const report = await coverage(req);
      res.json({
        executive_report: {
          title: "Shield-PDP Stage 6 detection coverage intelligence",
          detection_sla: "simulation alerts available within validation window",
          coverage_score: report.summary.visibility_score,
          blindspots: report.summary.blindspots,
          services_with_telemetry: report.summary.services_with_telemetry,
          attack_techniques_covered: report.attack_heatmap.length,
        },
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  });
}

function registerChaosRoutes() {
  const guard = requireRoles(stage6GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/scenarios", "/api/inject", "/api/revert", "/api/active"] });
  });

  app.get("/api/scenarios", guard, (req, res) => {
    res.json({ scenarios: chaosScenarios, request_id: req.requestId });
  });

  app.post("/api/inject", guard, (req, res) => {
    const scenario = findById(chaosScenarios, req.body.scenario_id || "telemetry-drop-sim");
    if (!scenario) {
      return res.status(400).json({ error: "unsupported_chaos_scenario", allowed_scenarios: chaosScenarios.map((item) => item.id), request_id: req.requestId });
    }
    const injection = {
      injection_id: stableId("chaos", [scenario.id, req.requestId, Date.now().toString()]),
      scenario_id: scenario.id,
      name: scenario.name,
      status: "simulated_active",
      duration_seconds: clampNumber(req.body.duration_seconds, 300, 30, 3600),
      started_at: new Date().toISOString(),
      reversible: true,
      controls: stage6Controls({ failure_injection_real: false, reversible: true }),
    };
    chaosInjections.push(injection);
    recordStage6Event(req, "stage6.chaos.injected", {
      severity: scenario.severity,
      mitre: scenario.mitre,
      injection_id: injection.injection_id,
      scenario_id: scenario.id,
      duration_seconds: injection.duration_seconds,
      controls: { failure_injection_real: false, reversible: true },
    });
    recordStage6Event(req, scenario.event, {
      severity: scenario.severity,
      mitre: scenario.mitre,
      injection_id: injection.injection_id,
      scenario_id: scenario.id,
      controls: { failure_injection_real: false, reversible: true },
    });
    res.status(202).json({ injection, request_id: req.requestId });
  });

  app.post("/api/revert", guard, (req, res) => {
    const targetId = req.body.injection_id;
    const reverted = [];
    chaosInjections.forEach((item) => {
      if (item.status !== "simulated_active") {
        return;
      }
      if (targetId && item.injection_id !== targetId) {
        return;
      }
      item.status = "simulated_reverted";
      item.reverted_at = new Date().toISOString();
      reverted.push(item);
      recordStage6Event(req, "stage6.chaos.reverted", { severity: "low", mitre: [], injection_id: item.injection_id, scenario_id: item.scenario_id });
    });
    res.json({ reverted, active: chaosInjections.filter((item) => item.status === "simulated_active"), request_id: req.requestId });
  });

  app.get("/api/active", guard, (req, res) => {
    res.json({ active: chaosInjections.filter((item) => item.status === "simulated_active"), request_id: req.requestId });
  });
}

function registerIntelligenceDashboardRoutes() {
  const guard = requireRoles(stage6GuardRoles);

  app.get("/", guard, (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shield-PDP Intelligence</title>
  <style>
    body{margin:0;background:#111827;color:#e5e7eb;font-family:Inter,system-ui,sans-serif}
    main{max-width:1180px;margin:0 auto;padding:24px}
    section{border-top:1px solid #374151;padding:16px 0}
    code{color:#93c5fd}
    pre{white-space:pre-wrap;background:#0f172a;border:1px solid #374151;border-radius:8px;padding:14px}
  </style>
</head>
<body>
  <main>
    <h1>Shield-PDP Intelligence</h1>
    <section><p>Principal: <code>${req.principal.sub || req.principal.username}</code></p></section>
    <section><pre>${JSON.stringify({ endpoints: ["/api/views/soc", "/api/views/threat-hunter", "/api/executive", "/api/analysis/incident-summary", "/api/time-travel/reconstruct"] }, null, 2)}</pre></section>
  </main>
</body>
</html>`);
  });

  app.get("/api/views/:role", guard, (req, res) => {
    const role = String(req.params.role || "soc");
    const views = {
      soc: ["incident queue", "timeline reconstruction", "alert SLA", "chaos status"],
      "threat-hunter": ["hunt packs", "telemetry pivots", "attack graph paths", "anomaly clusters"],
      "detection-engineer": ["coverage matrix", "blindspots", "rule validation", "false-positive notes"],
      "red-team-operator": ["campaign status", "safe controls", "replay export", "detection-aware timing"],
      "purple-team-coordinator": ["exercise timeline", "coverage gaps", "SOC notes", "replay controls"],
      executive: ["blast radius", "coverage score", "incident progression", "detection SLA"],
    };
    res.json({ role, widgets: views[role] || views.soc, request_id: req.requestId });
  });

  app.get("/api/executive", guard, async (req, res, next) => {
    try {
      const coverage = await fetchJsonWithServiceAuth(`${COVERAGE_INTEL_URL}/api/executive-report?limit=${Number(req.query.limit || 900)}`, { requestId: req.requestId });
      const graph = await fetchJsonWithServiceAuth(`${ATTACK_GRAPH_URL}/api/blast-radius?service=secrets-broker`, { requestId: req.requestId });
      res.json({
        executive_dashboard: {
          attack_impact_score: graph.blast_radius?.risk_score || 0,
          blast_radius: graph.blast_radius,
          coverage: coverage.executive_report,
          incident_timeline_summary: "available through /correlation/api/timeline",
          detection_sla: coverage.executive_report?.detection_sla,
        },
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/analysis/incident-summary", guard, async (req, res, next) => {
    try {
      const events = (await fetchLogEvents(Number(req.body.limit || 900))).map(normalizeTelemetryEvent);
      const alerts = detectAlerts(events.map((event) => event.raw));
      const summary = {
        analysis_id: stableId("analysis", [req.requestId, Date.now().toString()]),
        mode: "defensive-explainable-summary",
        offensive_automation: false,
        events_reviewed: events.length,
        alerts_reviewed: alerts.length,
        top_principals: summarizeIdentityAbuse(alerts).slice(0, 5),
        likely_attack_chain: [...new Set(events.filter((event) => event.attack_simulation).map((event) => event.event_name))].slice(0, 12),
        recommendations: [
          "Review correlated high-severity principals first.",
          "Validate persistence cleanup and chaos reversion markers.",
          "Compare ATT&CK coverage with active campaign phases.",
        ],
      };
      recordStage6Event(req, "stage6.ai.defensive_summary_generated", {
        severity: "low",
        mitre: [],
        analysis_id: summary.analysis_id,
        events_reviewed: summary.events_reviewed,
        alerts_reviewed: summary.alerts_reviewed,
        controls: { defensive_use_only: true, exploit_generation: false, external_ai_call: false },
      });
      res.json({ summary, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/time-travel/reconstruct", guard, async (req, res, next) => {
    try {
      const replayId = req.body.replay_id || null;
      const events = (await fetchLogEvents(Number(req.body.limit || 900))).map(normalizeTelemetryEvent);
      const selected = replayId ? events.filter((event) => event.replay_id === replayId || event.raw.replay_id === replayId) : events.filter((event) => event.attack_simulation).slice(0, 100);
      const graph = buildAttackGraph(selected.map((event) => event.raw));
      const alerts = detectAlerts(selected.map((event) => event.raw));
      const snapshot = {
        snapshot_id: stableId("snapshot", [req.requestId, replayId || "latest", Date.now().toString()]),
        replay_id: replayId,
        deterministic: true,
        created_at: new Date().toISOString(),
        infrastructure_state: { services: serviceTargets().map((target) => target.name), graph_nodes: graph.summary.nodes, graph_edges: graph.summary.edges },
        attack_timeline: buildTimeline(selected.map((event) => event.raw), alerts),
        detection_flow: alerts.map((alert) => ({ rule_id: alert.rule_id, event_name: alert.event_name, severity: alert.severity })),
        graph_state: graph.summary,
        controls: stage6Controls({ deterministic_replay: true }),
      };
      replaySnapshots.push(snapshot);
      recordStage6Event(req, "stage6.replay.reconstruction_completed", {
        severity: "medium",
        mitre: ["T1082"],
        snapshot_id: snapshot.snapshot_id,
        replay_id: replayId,
        timeline_events: snapshot.attack_timeline.length,
        alerts: snapshot.detection_flow.length,
      });
      res.status(202).json({ reconstruction: snapshot, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/replay/snapshots", guard, (req, res) => {
    res.json({ snapshots: replaySnapshots.slice(-25).reverse(), request_id: req.requestId });
  });
}

const stage7GuardRoles = [
  "admin",
  "soc_analyst",
  "detection_engineer",
  "threat_hunter",
  "incident_responder",
  "red_team_operator",
  "developer",
  "platform_engineer",
  "resilience_engineer",
  "compliance_manager",
  "service_platform",
  "service_kubernetes",
  "service_gitops",
  "service_telemetry_fabric",
  "service_resilience",
  "service_environment",
  "service_mesh",
  "service_governance",
  "service_delivery_governance",
  "service_observability",
  "service_soc",
];

const stage7Namespaces = [
  { name: "shield-edge", trust_zone: "north-south ingress", quota: "small", labels: { "shield.zone": "edge" } },
  { name: "shield-identity", trust_zone: "identity control plane", quota: "medium", labels: { "shield.zone": "identity" } },
  { name: "shield-enterprise", trust_zone: "business services", quota: "large", labels: { "shield.zone": "enterprise" } },
  { name: "shield-devops", trust_zone: "CI/CD and artifacts", quota: "medium", labels: { "shield.zone": "devops" } },
  { name: "shield-observability", trust_zone: "telemetry, SIEM, correlation", quota: "large", labels: { "shield.zone": "observability" } },
  { name: "shield-intelligence", trust_zone: "digital twin and cyber range intelligence", quota: "large", labels: { "shield.zone": "intelligence" } },
];

const stage7DeploymentTemplates = [
  { service: "auth-service", namespace: "shield-identity", replicas: 2, probes: ["readiness:/ready", "liveness:/health"], resources: { cpu: "250m", memory: "256Mi" } },
  { service: "log-collector", namespace: "shield-observability", replicas: 2, probes: ["readiness:/ready", "liveness:/health"], resources: { cpu: "250m", memory: "256Mi" } },
  { service: "detection-engine", namespace: "shield-observability", replicas: 2, probes: ["readiness:/ready", "liveness:/health"], resources: { cpu: "300m", memory: "384Mi" } },
  { service: "correlation-engine", namespace: "shield-observability", replicas: 2, probes: ["readiness:/ready", "liveness:/health"], resources: { cpu: "300m", memory: "384Mi" } },
  { service: "telemetry-fabric", namespace: "shield-observability", replicas: 2, probes: ["readiness:/ready", "liveness:/health"], resources: { cpu: "350m", memory: "512Mi" } },
  { service: "governance-engine", namespace: "shield-intelligence", replicas: 2, probes: ["readiness:/ready", "liveness:/health"], resources: { cpu: "250m", memory: "256Mi" } },
];

const stage7ResourceQuotas = [
  { namespace: "shield-edge", cpu: "2", memory: "2Gi", pods: 12 },
  { namespace: "shield-identity", cpu: "3", memory: "4Gi", pods: 16 },
  { namespace: "shield-enterprise", cpu: "6", memory: "8Gi", pods: 32 },
  { namespace: "shield-devops", cpu: "4", memory: "6Gi", pods: 20 },
  { namespace: "shield-observability", cpu: "8", memory: "12Gi", pods: 36 },
  { namespace: "shield-intelligence", cpu: "6", memory: "8Gi", pods: 28 },
];

const stage7AutoscalingPolicies = [
  { target: "telemetry-fabric", namespace: "shield-observability", min_replicas: 2, max_replicas: 6, metric: "requests_per_second", threshold: 200 },
  { target: "detection-engine", namespace: "shield-observability", min_replicas: 2, max_replicas: 5, metric: "event_lag_seconds", threshold: 10 },
  { target: "campaign-orchestrator", namespace: "shield-intelligence", min_replicas: 1, max_replicas: 4, metric: "campaign_queue_depth", threshold: 20 },
];

const stage7GitOpsApplications = [
  { name: "shield-pdp-local-lab", environment: "local", source: "gitops/environments/local", sync_policy: "manual", rollback_supported: true },
  { name: "shield-pdp-distributed-lab", environment: "distributed", source: "gitops/environments/distributed", sync_policy: "staged", rollback_supported: true },
  { name: "shield-pdp-observability", environment: "shared-observability", source: "helm/shield-pdp", sync_policy: "approval-gated", rollback_supported: true },
];

const stage7TelemetryPipelines = [
  { id: "otel-traces", collector: "OpenTelemetry Collector", sink: "tempo-jaeger-compatible", ha: true, replay_compatible: true },
  { id: "prometheus-metrics", collector: "Prometheus", sink: "grafana-dashboards", ha: true, replay_compatible: true },
  { id: "loki-logs", collector: "Loki-compatible log pipeline", sink: "opensearch-loki-compatible", ha: true, replay_compatible: true },
  { id: "attack-chain-correlation", collector: "Shield correlation engine", sink: "soc-dashboard", ha: true, replay_compatible: true },
];

const stage7ResiliencePlans = [
  { id: "telemetry-queue-failover", name: "Telemetry queue failover", component: "enterprise-rabbitmq", rpo_seconds: 60, rto_seconds: 180, reversible: true },
  { id: "log-pipeline-degradation", name: "Log pipeline degradation recovery", component: "log-collector", rpo_seconds: 120, rto_seconds: 300, reversible: true },
  { id: "identity-control-plane-restart", name: "Identity control-plane rolling restart", component: "auth-service", rpo_seconds: 0, rto_seconds: 120, reversible: true },
];

const stage7EnvironmentTopologies = [
  {
    id: "multi-region-enterprise",
    name: "Multi-region enterprise simulation",
    regions: ["id-jakarta", "sg-shared-services", "us-dr"],
    tenants: ["parent-company", "subsidiary-finance", "vendor-support"],
    trust_links: ["vpn-workforce-to-parent", "vendor-to-devops-approval", "shared-observability-to-all-regions"],
  },
  {
    id: "hybrid-cloud-workforce",
    name: "Hybrid-cloud and remote workforce simulation",
    regions: ["onprem-dc", "cloud-shared", "remote-workforce"],
    tenants: ["engineering", "hr", "finance", "contractor"],
    trust_links: ["vpn-to-edge", "zero-trust-app-access", "supply-chain-artifact-trust"],
  },
];

const stage7MeshPolicies = [
  { id: "identity-to-enterprise-mtls", source: "shield-identity", destination: "shield-enterprise", mtls: "STRICT", decision: "allow", telemetry_event: true },
  { id: "devops-to-secrets-approval", source: "shield-devops", destination: "shield-identity", mtls: "STRICT", decision: "approval_required", telemetry_event: true },
  { id: "vendor-to-admin-deny", source: "vendor-support", destination: "shield-enterprise-admin", mtls: "STRICT", decision: "deny", telemetry_event: true },
  { id: "observability-read-all", source: "shield-observability", destination: "all-zones", mtls: "STRICT", decision: "read_only_allow", telemetry_event: true },
];

const stage7GovernancePolicies = [
  { id: "secret-rotation-30d", domain: "secrets", control: "rotation_window_days", expected: 30, current: 27, status: "compliant" },
  { id: "service-account-minimum-scope", domain: "identity", control: "least_privilege", expected: "enforced", current: "review_required_for_legacy_ci", status: "drift_detected" },
  { id: "namespace-quota-required", domain: "kubernetes", control: "resource_quota", expected: "present", current: "present", status: "compliant" },
  { id: "deployment-approval-required", domain: "delivery", control: "approval_gate", expected: "enabled", current: "enabled", status: "compliant" },
];

const stage7DeliveryControls = [
  { id: "signed-artifact", name: "Signed artifact simulation", required: true, telemetry_tag: "stage7.delivery.artifact_verified" },
  { id: "image-verification", name: "Image verification workflow", required: true, telemetry_tag: "stage7.delivery.image_verified" },
  { id: "dependency-scan", name: "Dependency scanning simulation", required: true, telemetry_tag: "stage7.delivery.dependency_scan_completed" },
  { id: "approval-gate", name: "Deployment approval workflow", required: true, telemetry_tag: "stage7.delivery.approval_recorded" },
  { id: "infra-policy-validation", name: "Infrastructure policy validation", required: true, telemetry_tag: "stage7.delivery.policy_validated" },
];

const stage7Rollouts = [];
const stage7Traces = [];
const stage7Failovers = [];
const stage7GovernanceRuns = [];
const stage7Approvals = [];

function stage7Controls(extra = {}) {
  return {
    isolated_lab_only: true,
    synthetic_only: true,
    destructive_actions: false,
    command_execution: false,
    exploit_execution: false,
    external_callbacks: false,
    public_targets: false,
    real_infrastructure_mutation: false,
    real_cluster_mutation: false,
    reversible: true,
    replayable: true,
    telemetry_observable: true,
    ...extra,
  };
}

function recordStage7Event(req, event, extra = {}) {
  const { controls, ...details } = extra;
  const payload = {
    event,
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    request_id: req.requestId,
    principal: principalLabel(req),
    lab_stage: "stage7-productionization-enterprise-scale",
    severity: details.severity || "medium",
    mitre: details.mitre || [],
    safe_simulation: true,
    simulation_scope: "isolated-lab",
    controls: stage7Controls(controls || {}),
    ...details,
  };
  log("INFO", "Stage 7 productionization simulation event recorded.", payload);
  emitTelemetry(payload);
  return payload;
}

function stage7ServiceNames() {
  return serviceTargets().map((target) => target.name);
}

function buildStage7Trace(events, requestId) {
  const normalized = events.map(normalizeTelemetryEvent);
  const selected = normalized.slice(0, 30);
  const traceId = stableId("trace", [requestId, selected.map((event) => event.event_id).join(",") || Date.now().toString()]);
  return {
    trace_id: traceId,
    span_count: Math.max(selected.length, 1),
    service_count: new Set(selected.map((event) => event.source_service)).size || 1,
    attack_chain_trace: selected.filter((event) => event.attack_simulation || String(event.event_name).startsWith("stage")).map((event) => ({
      span_id: stableId("span", [traceId, event.event_id]),
      service: event.source_service,
      operation: event.event_name,
      request_id: event.request_id,
      mitre: event.mitre,
    })),
    replay_compatible: true,
    telemetry_integrity: "preserved",
  };
}

function buildMultiEnvironmentAttackGraph(topology) {
  const graph = {
    nodes: [],
    edges: [],
  };
  topology.regions.forEach((region) => graph.nodes.push({ id: `region:${region}`, type: "region", label: region }));
  topology.tenants.forEach((tenant) => graph.nodes.push({ id: `tenant:${tenant}`, type: "tenant", label: tenant }));
  topology.trust_links.forEach((link, index) => {
    const from = topology.tenants[index % topology.tenants.length];
    const to = topology.regions[index % topology.regions.length];
    graph.edges.push({ id: stableId("env-edge", [topology.id, link]), from: `tenant:${from}`, to: `region:${to}`, relationship: link, trust_boundary: true });
  });
  graph.summary = {
    topology_id: topology.id,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    blast_radius_score: Math.min(100, graph.edges.length * 12 + graph.nodes.length * 3),
  };
  return graph;
}

function governanceScore() {
  const compliant = stage7GovernancePolicies.filter((policy) => policy.status === "compliant").length;
  return Math.round((compliant / stage7GovernancePolicies.length) * 100);
}

function registerKubernetesOrchestratorRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/manifests", "/api/namespaces", "/api/autoscaling", "/api/validate"] });
  });

  app.get("/api/manifests", guard, (req, res) => {
    res.json({
      manifests: stage7DeploymentTemplates,
      directories: ["kubernetes/base", "kubernetes/overlays/local", "kubernetes/overlays/distributed"],
      compatibility: { compose_overlay_preserved: true, local_lab_mode: true, distributed_mode: true },
      request_id: req.requestId,
    });
  });

  app.get("/api/namespaces", guard, (req, res) => {
    res.json({ namespaces: stage7Namespaces, quotas: stage7ResourceQuotas, request_id: req.requestId });
  });

  app.get("/api/autoscaling", guard, (req, res) => {
    res.json({ autoscaling_policies: stage7AutoscalingPolicies, request_id: req.requestId });
  });

  app.get("/api/deployment-overlays", guard, (req, res) => {
    res.json({
      overlays: [
        { name: "local", path: "kubernetes/overlays/local", strategy: "single-node lab compatibility" },
        { name: "distributed", path: "kubernetes/overlays/distributed", strategy: "multi-node cyber range deployment" },
      ],
      replay_compatibility: true,
      request_id: req.requestId,
    });
  });

  app.post("/api/validate", guard, (req, res) => {
    const manifestCount = stage7DeploymentTemplates.length + stage7Namespaces.length + stage7ResourceQuotas.length + stage7AutoscalingPolicies.length;
    recordStage7Event(req, "stage7.kubernetes.manifest_validated", {
      severity: "medium",
      mitre: ["T1611"],
      manifest_count: manifestCount,
      namespaces: stage7Namespaces.length,
      controls: { real_cluster_mutation: false, validation_only: true },
    });
    res.json({
      validation: {
        status: "passed",
        manifest_count: manifestCount,
        namespace_segmentation: "configured",
        health_probes: "configured",
        resource_quotas: "configured",
        autoscaling: "configured",
        real_cluster_mutation: false,
      },
      request_id: req.requestId,
    });
  });
}

function registerGitOpsControllerRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/applications", "/api/helm/releases", "/api/rollouts/plan", "/api/rollbacks/simulate"] });
  });

  app.get("/api/applications", guard, (req, res) => {
    res.json({ applications: stage7GitOpsApplications, argocd_compatible: true, request_id: req.requestId });
  });

  app.get("/api/helm/releases", guard, (req, res) => {
    res.json({
      chart: { name: "shield-pdp", path: "helm/shield-pdp", version: "0.7.0" },
      releases: stage7GitOpsApplications.map((app) => ({ release: app.name, environment: app.environment, rollback_supported: app.rollback_supported })),
      request_id: req.requestId,
    });
  });

  app.post("/api/rollouts/plan", guard, (req, res) => {
    const appId = String(req.body.application || "shield-pdp-distributed-lab");
    const application = stage7GitOpsApplications.find((item) => item.name === appId) || stage7GitOpsApplications[0];
    const rollout = {
      rollout_id: stableId("rollout", [application.name, req.requestId, Date.now().toString()]),
      application: application.name,
      environment: application.environment,
      strategy: req.body.strategy || "staged-canary",
      status: "planned",
      rollback_supported: application.rollback_supported,
      stages: ["render", "policy-check", "approval", "sync-wave-1", "sync-wave-2"],
      controls: stage7Controls({ real_deployment: false, gitops_plan_only: true }),
      created_at: new Date().toISOString(),
    };
    stage7Rollouts.push(rollout);
    recordStage7Event(req, "stage7.gitops.rollout_planned", {
      severity: "medium",
      mitre: ["T1195.002"],
      rollout_id: rollout.rollout_id,
      application: rollout.application,
      strategy: rollout.strategy,
      controls: { real_deployment: false, gitops_plan_only: true },
    });
    res.status(202).json({ rollout, request_id: req.requestId });
  });

  app.post("/api/rollbacks/simulate", guard, (req, res) => {
    const rollback = {
      rollback_id: stableId("rollback", [req.body.rollout_id || "latest", req.requestId, Date.now().toString()]),
      target_rollout_id: req.body.rollout_id || null,
      status: "simulated_ready",
      rollback_window_seconds: 300,
      real_deployment: false,
      created_at: new Date().toISOString(),
    };
    recordStage7Event(req, "stage7.gitops.rollback_simulated", {
      severity: "low",
      mitre: ["T1195.002"],
      rollback_id: rollback.rollback_id,
      target_rollout_id: rollback.target_rollout_id,
      controls: { real_deployment: false, rollback_only: true },
    });
    res.json({ rollback, request_id: req.requestId });
  });
}

function registerTelemetryFabricRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/pipelines", "/api/traces/generate", "/api/service-map", "/api/sla"] });
  });

  app.get("/api/pipelines", guard, (req, res) => {
    res.json({ pipelines: stage7TelemetryPipelines, request_id: req.requestId });
  });

  app.post("/api/traces/generate", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.body.limit || 900));
      const trace = buildStage7Trace(events, req.requestId);
      stage7Traces.push(trace);
      recordStage7Event(req, "stage7.telemetry.trace_generated", {
        severity: "medium",
        mitre: ["T1041", "T1021"],
        trace_id: trace.trace_id,
        span_count: trace.span_count,
        service_count: trace.service_count,
        controls: { trace_replay_compatible: true },
      });
      res.status(202).json({ trace, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/service-map", guard, async (req, res, next) => {
    try {
      const events = (await fetchLogEvents(Number(req.query.limit || 900))).map(normalizeTelemetryEvent);
      const services = {};
      events.forEach((event) => {
        services[event.source_service] ||= { service: event.source_service, events: 0, requests: new Set() };
        services[event.source_service].events += 1;
        if (event.request_id) {
          services[event.source_service].requests.add(event.request_id);
        }
      });
      res.json({
        service_map: Object.values(services).map((item) => ({ service: item.service, events: item.events, request_ids: item.requests.size })),
        dependency_targets: stage7ServiceNames(),
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sla", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.query.limit || 900));
      const alerts = detectAlerts(events);
      const stage7Events = events.filter((event) => String(event.event || "").startsWith("stage7."));
      const sla = {
        trace_replay_compatibility: true,
        cross_service_correlation: true,
        telemetry_integrity: "preserved",
        event_volume: events.length,
        stage7_events: stage7Events.length,
        alerts: alerts.length,
        telemetry_sla_score: Math.min(100, 90 + Math.min(stage7Events.length, 10)),
      };
      recordStage7Event(req, "stage7.telemetry.sla_evaluated", {
        severity: "medium",
        mitre: ["T1041"],
        telemetry_sla_score: sla.telemetry_sla_score,
        stage7_events: sla.stage7_events,
      });
      res.json({ sla, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });
}

function registerResilienceHubRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/ha/topology", "/api/failover/simulate", "/api/backups", "/api/recovery/verify"] });
  });

  app.get("/api/ha/topology", guard, (req, res) => {
    res.json({
      topology: {
        telemetry_pipeline: ["log-collector", "enterprise-rabbitmq", "siem-bridge", "detection-engine", "correlation-engine"],
        replicated_components: ["telemetry-fabric", "log-collector", "detection-engine", "correlation-engine"],
        rolling_updates: true,
        replay_consistency: true,
      },
      plans: stage7ResiliencePlans,
      request_id: req.requestId,
    });
  });

  app.post("/api/failover/simulate", guard, (req, res) => {
    const plan = findById(stage7ResiliencePlans, req.body.plan_id || "telemetry-queue-failover") || stage7ResiliencePlans[0];
    const failover = {
      failover_id: stableId("failover", [plan.id, req.requestId, Date.now().toString()]),
      plan_id: plan.id,
      component: plan.component,
      status: "simulated_completed",
      replay_consistency: "preserved",
      detection_integrity: "preserved",
      telemetry_persistence: "validated",
      reversible: true,
      created_at: new Date().toISOString(),
      controls: stage7Controls({ real_outage: false, failover_simulation_only: true }),
    };
    stage7Failovers.push(failover);
    recordStage7Event(req, "stage7.resilience.failover_simulated", {
      severity: "high",
      mitre: ["T1499", "T1562.008"],
      failover_id: failover.failover_id,
      plan_id: plan.id,
      component: plan.component,
      controls: { real_outage: false, failover_simulation_only: true },
    });
    res.status(202).json({ failover, request_id: req.requestId });
  });

  app.get("/api/backups", guard, (req, res) => {
    res.json({
      backup_policies: [
        { target: "event-store", cadence: "hourly-synthetic", retention: "7d", replay_export: true },
        { target: "gitops-state", cadence: "on-change", retention: "30d", rollback_supported: true },
        { target: "governance-evidence", cadence: "daily", retention: "30d", audit_ready: true },
      ],
      request_id: req.requestId,
    });
  });

  app.post("/api/recovery/verify", guard, (req, res) => {
    const verification = {
      verification_id: stableId("dr", [req.requestId, Date.now().toString()]),
      status: "passed",
      replay_integrity: "preserved",
      telemetry_integrity: "preserved",
      detection_integrity: "preserved",
      simulated_restore: true,
      destructive_actions: false,
    };
    recordStage7Event(req, "stage7.resilience.recovery_verified", {
      severity: "medium",
      mitre: ["T1499"],
      verification_id: verification.verification_id,
      controls: { real_restore: false, verification_only: true },
    });
    res.json({ verification, request_id: req.requestId });
  });
}

function registerEnvironmentManagerRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/topologies", "/api/topologies/generate", "/api/tenant-isolation", "/api/attack-graph"] });
  });

  app.get("/api/topologies", guard, (req, res) => {
    res.json({ topologies: stage7EnvironmentTopologies, request_id: req.requestId });
  });

  app.post("/api/topologies/generate", guard, (req, res) => {
    const topology = findById(stage7EnvironmentTopologies, req.body.topology_id || "multi-region-enterprise") || stage7EnvironmentTopologies[0];
    const graph = buildMultiEnvironmentAttackGraph(topology);
    recordStage7Event(req, "stage7.environment.topology_generated", {
      severity: "medium",
      mitre: ["T1590", "T1046"],
      topology_id: topology.id,
      regions: topology.regions.length,
      tenants: topology.tenants.length,
      trust_links: topology.trust_links.length,
    });
    res.status(202).json({ topology, graph, request_id: req.requestId });
  });

  app.get("/api/tenant-isolation", guard, (req, res) => {
    res.json({
      tenants: stage7EnvironmentTopologies.flatMap((topology) => topology.tenants).filter((item, index, all) => all.indexOf(item) === index),
      isolation_controls: ["namespace-boundaries", "network-policies", "service-account-scopes", "tenant-aware-telemetry"],
      cross_environment_telemetry: true,
      request_id: req.requestId,
    });
  });

  app.get("/api/attack-graph", guard, (req, res) => {
    const graphs = stage7EnvironmentTopologies.map((topology) => buildMultiEnvironmentAttackGraph(topology));
    res.json({ graphs, multi_environment_attack_graph: true, request_id: req.requestId });
  });
}

function registerZeroTrustMeshRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/policies", "/api/policies/evaluate", "/api/mtls/status", "/api/trust-boundaries"] });
  });

  app.get("/api/policies", guard, (req, res) => {
    res.json({ policies: stage7MeshPolicies, request_id: req.requestId });
  });

  app.post("/api/policies/evaluate", guard, (req, res) => {
    const source = String(req.body.source || "shield-devops");
    const destination = String(req.body.destination || "shield-identity");
    const policy =
      stage7MeshPolicies.find((item) => item.source === source && item.destination === destination) ||
      stage7MeshPolicies.find((item) => item.source === source || item.destination === destination) ||
      stage7MeshPolicies[0];
    const evaluation = {
      evaluation_id: stableId("mesh", [source, destination, req.requestId]),
      source,
      destination,
      decision: policy.decision,
      mtls: policy.mtls,
      identity_aware_routing: true,
      policy_event_replayable: true,
    };
    recordStage7Event(req, "stage7.mesh.policy_evaluated", {
      severity: policy.decision === "deny" ? "high" : "medium",
      mitre: ["T1021", "T1550.001"],
      evaluation_id: evaluation.evaluation_id,
      source,
      destination,
      decision: evaluation.decision,
    });
    res.json({ evaluation, request_id: req.requestId });
  });

  app.get("/api/mtls/status", guard, (req, res) => {
    res.json({
      mtls: { mode: "STRICT-simulation", certificate_rotation: "simulated-24h", identity_provider: "auth-service", real_certificates_issued: false },
      service_identities: serviceAccounts.map((account) => ({ client_id: account.client_id, roles: account.roles })),
      request_id: req.requestId,
    });
  });

  app.get("/api/trust-boundaries", guard, (req, res) => {
    res.json({
      boundaries: stage7MeshPolicies.map((policy) => ({ source: policy.source, destination: policy.destination, decision: policy.decision, mtls: policy.mtls })),
      observable_policy_events: true,
      replay_compatible: true,
      request_id: req.requestId,
    });
  });
}

function registerGovernanceEngineRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/policies", "/api/compliance/check", "/api/secrets/rotate", "/api/drift", "/api/integrity"] });
  });

  app.get("/api/policies", guard, (req, res) => {
    res.json({ policies: stage7GovernancePolicies, score: governanceScore(), request_id: req.requestId });
  });

  app.post("/api/compliance/check", guard, (req, res) => {
    const run = {
      run_id: stableId("gov", [req.requestId, Date.now().toString()]),
      status: "completed",
      score: governanceScore(),
      checks: stage7GovernancePolicies,
      compliance_simulation: true,
      evidence: ["rbac-export", "namespace-quotas", "deployment-approval-records", "telemetry-integrity"],
      created_at: new Date().toISOString(),
    };
    stage7GovernanceRuns.push(run);
    recordStage7Event(req, "stage7.governance.compliance_checked", {
      severity: "medium",
      mitre: ["T1082"],
      run_id: run.run_id,
      score: run.score,
    });
    if (stage7GovernancePolicies.some((policy) => policy.status === "drift_detected")) {
      recordStage7Event(req, "stage7.governance.policy_drift_detected", {
        severity: "high",
        mitre: ["T1078", "T1550.001"],
        run_id: run.run_id,
        drift_count: stage7GovernancePolicies.filter((policy) => policy.status === "drift_detected").length,
      });
    }
    res.json({ compliance: run, request_id: req.requestId });
  });

  app.post("/api/secrets/rotate", guard, (req, res) => {
    const rotation = {
      rotation_id: stableId("rotate", [req.body.secret_ref || "service-account-lab", req.requestId, Date.now().toString()]),
      secret_ref: req.body.secret_ref || "service-account-lab",
      status: "simulated_rotated",
      old_secret_exposed: false,
      new_secret_material_generated: false,
      lifecycle_tracked: true,
      controls: stage7Controls({ real_secret_rotation: false, synthetic_secret_reference_only: true }),
    };
    recordStage7Event(req, "stage7.governance.secrets_rotation_simulated", {
      severity: "high",
      mitre: ["T1552", "T1528"],
      rotation_id: rotation.rotation_id,
      secret_ref: rotation.secret_ref,
      controls: { real_secret_rotation: false, synthetic_secret_reference_only: true },
    });
    res.status(202).json({ rotation, request_id: req.requestId });
  });

  app.get("/api/drift", guard, (req, res) => {
    res.json({
      drift: stage7GovernancePolicies.filter((policy) => policy.status === "drift_detected"),
      policy_drift_detection: true,
      request_id: req.requestId,
    });
  });

  app.get("/api/integrity", guard, (req, res) => {
    res.json({
      integrity: {
        manifests: "tracked",
        helm_chart: "tracked",
        compose_overlay: "tracked",
        replay_compatibility: "preserved",
        telemetry_integrity: "preserved",
      },
      request_id: req.requestId,
    });
  });
}

function registerDeliveryGovernanceRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/controls", "/api/artifacts/verify", "/api/dependency-scan", "/api/approvals/request", "/api/policy/validate"] });
  });

  app.get("/api/controls", guard, (req, res) => {
    res.json({ controls: stage7DeliveryControls, request_id: req.requestId });
  });

  app.post("/api/artifacts/verify", guard, (req, res) => {
    const verification = {
      verification_id: stableId("artifactverify", [req.body.artifact_id || latestArtifact.artifact_id, req.requestId]),
      artifact_id: req.body.artifact_id || latestArtifact.artifact_id,
      signature_status: "simulated_valid",
      image_verification: "simulated_valid",
      provenance: "synthetic-slsa-like-attestation",
      real_deployment: false,
    };
    recordStage7Event(req, "stage7.delivery.artifact_verified", {
      severity: "medium",
      mitre: ["T1195.002"],
      verification_id: verification.verification_id,
      artifact_id: verification.artifact_id,
      controls: { real_deployment: false, signature_simulation_only: true },
    });
    recordStage7Event(req, "stage7.delivery.image_verified", {
      severity: "medium",
      mitre: ["T1195.002"],
      verification_id: verification.verification_id,
      controls: { real_image_pull: false, verification_simulation_only: true },
    });
    res.json({ verification, request_id: req.requestId });
  });

  app.post("/api/dependency-scan", guard, (req, res) => {
    const scan = {
      scan_id: stableId("depscan", [req.body.repository || "customer-api", req.requestId, Date.now().toString()]),
      repository: req.body.repository || "customer-api",
      status: "completed",
      findings: [
        { package: "express", severity: "informational", status: "accepted-current-lab-version" },
        { package: "base-image", severity: "low", status: "scheduled-review" },
      ],
      real_package_download: false,
    };
    recordStage7Event(req, "stage7.delivery.dependency_scan_completed", {
      severity: "medium",
      mitre: ["T1195.002"],
      scan_id: scan.scan_id,
      repository: scan.repository,
      finding_count: scan.findings.length,
      controls: { real_package_download: false, scan_simulation_only: true },
    });
    res.json({ scan, request_id: req.requestId });
  });

  app.post("/api/approvals/request", guard, (req, res) => {
    const approval = {
      approval_id: stableId("approval", [req.body.environment || "distributed", req.requestId, Date.now().toString()]),
      environment: req.body.environment || "distributed",
      status: "simulated_approved",
      approver: principalLabel(req),
      required_controls: stage7DeliveryControls.filter((control) => control.required).map((control) => control.id),
      real_deployment: false,
      created_at: new Date().toISOString(),
    };
    stage7Approvals.push(approval);
    recordStage7Event(req, "stage7.delivery.approval_recorded", {
      severity: "medium",
      mitre: ["T1195.002"],
      approval_id: approval.approval_id,
      environment: approval.environment,
      controls: { real_deployment: false, approval_simulation_only: true },
    });
    res.status(202).json({ approval, request_id: req.requestId });
  });

  app.post("/api/policy/validate", guard, (req, res) => {
    const validation = {
      validation_id: stableId("deliverypolicy", [req.requestId, Date.now().toString()]),
      status: "passed",
      checks: ["signed-artifact", "image-verification", "dependency-scan", "approval-gate", "namespace-quota"],
      policy_engine: "shield-stage7-synthetic-policy-engine",
      real_deployment: false,
    };
    recordStage7Event(req, "stage7.delivery.policy_validated", {
      severity: "medium",
      mitre: ["T1195.002"],
      validation_id: validation.validation_id,
      checks: validation.checks.length,
      controls: { real_deployment: false, policy_validation_only: true },
    });
    res.json({ validation, request_id: req.requestId });
  });
}

function registerScaleDashboardRoutes() {
  const guard = requireRoles(stage7GuardRoles);

  app.get("/", guard, (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shield-PDP Enterprise Scale</title>
  <style>
    body{margin:0;background:#111827;color:#e5e7eb;font-family:Inter,system-ui,sans-serif}
    main{max-width:1180px;margin:0 auto;padding:24px}
    section{border-top:1px solid #374151;padding:16px 0}
    code{color:#93c5fd}
    pre{white-space:pre-wrap;background:#0f172a;border:1px solid #374151;border-radius:8px;padding:14px}
  </style>
</head>
<body>
  <main>
    <h1>Shield-PDP Enterprise Scale</h1>
    <section><p>Principal: <code>${req.principal.sub || req.principal.username}</code></p></section>
    <section><pre>${JSON.stringify({ endpoints: ["/api/views/executive", "/api/executive", "/api/topology", "/api/replay/analytics", "/api/replay/export"] }, null, 2)}</pre></section>
  </main>
</body>
</html>`);
  });

  app.get("/api/views/:role", guard, (req, res) => {
    const role = String(req.params.role || "executive");
    const views = {
      executive: ["attack impact", "blast radius", "governance score", "telemetry SLA", "resilience posture"],
      "platform-engineer": ["cluster health", "namespace quotas", "GitOps rollouts", "service mesh policy events"],
      "soc-analyst": ["distributed attack traces", "tenant isolation events", "detection SLA", "replay analytics"],
      "compliance-manager": ["policy drift", "approval evidence", "secret lifecycle", "integrity checks"],
    };
    res.json({ role, widgets: views[role] || views.executive, request_id: req.requestId });
  });

  app.get("/api/executive", guard, async (req, res) => {
    const healthResults = await Promise.all(serviceTargets().map(checkTarget));
    let telemetrySla = { telemetry_sla_score: 0, stage7_events: 0 };
    try {
      const body = await fetchJsonWithServiceAuth(`${TELEMETRY_FABRIC_URL}/api/sla?limit=${Number(req.query.limit || 900)}`, { requestId: req.requestId });
      telemetrySla = body.sla || telemetrySla;
    } catch (error) {
      telemetrySla = { telemetry_sla_score: 0, stage7_events: 0, degraded_reason: error.message };
    }
    const report = {
      platform_maturity_score: Math.round((governanceScore() + Number(telemetrySla.telemetry_sla_score || 0) + 96) / 3),
      governance_score: governanceScore(),
      telemetry_sla: telemetrySla,
      cluster_health: { healthy: healthResults.filter((item) => item.status === "healthy").length, total: healthResults.length },
      tenant_isolation: "configured",
      resilience: { failovers_simulated: stage7Failovers.length, replay_consistency: "preserved" },
      delivery_governance: { approvals: stage7Approvals.length, rollouts: stage7Rollouts.length },
      synthetic_only: true,
    };
    recordStage7Event(req, "stage7.dashboard.executive_view_generated", {
      severity: "low",
      mitre: ["T1082"],
      platform_maturity_score: report.platform_maturity_score,
      governance_score: report.governance_score,
    });
    res.json({ executive_dashboard: report, request_id: req.requestId });
  });

  app.get("/api/topology", guard, (req, res) => {
    res.json({
      topology: {
        namespaces: stage7Namespaces,
        environments: stage7EnvironmentTopologies,
        mesh_policies: stage7MeshPolicies,
        services: stage7ServiceNames(),
      },
      request_id: req.requestId,
    });
  });

  app.get("/api/replay/analytics", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.query.limit || 900));
      const alerts = detectAlerts(events);
      res.json({
        replay_analytics: {
          timeline_events: buildTimeline(events, alerts).length,
          traces: stage7Traces.length,
          failovers: stage7Failovers.length,
          rollouts: stage7Rollouts.length,
          deterministic: true,
          telemetry_integrity: "preserved",
        },
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/replay/export", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.body.limit || 900));
      const alerts = detectAlerts(events);
      const exportBody = {
        export_id: stableId("stage7replay", [req.requestId, Date.now().toString()]),
        deterministic: true,
        timeline: buildTimeline(events, alerts).slice(0, 120),
        stage7_state: {
          rollouts: stage7Rollouts.slice(-20),
          traces: stage7Traces.slice(-20),
          failovers: stage7Failovers.slice(-20),
          governance_runs: stage7GovernanceRuns.slice(-20),
          approvals: stage7Approvals.slice(-20),
        },
        controls: stage7Controls({ replay_export_only: true }),
      };
      recordStage7Event(req, "stage7.replay.export_generated", {
        severity: "medium",
        mitre: ["T1082"],
        export_id: exportBody.export_id,
        timeline_events: exportBody.timeline.length,
      });
      res.status(202).json({ replay_export: exportBody, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });
}

const detectionRules = [
  {
    id: "SHIELD-S4-SSRF-001",
    title: "Controlled SSRF preview reached internal service",
    severity: "high",
    tactics: ["Initial Access", "Discovery"],
    mitre: ["T1190", "T1590"],
    match: { events: ["lab.ssrf_internal_service_preview"] },
    false_positives: "Expected during Stage 3 and Stage 4 lab validation windows.",
    recommendation: "Require strict egress policy, URL allowlists by business owner, and metadata endpoint deny rules.",
  },
  {
    id: "SHIELD-S4-METADATA-001",
    title: "Internal metadata endpoint accessed",
    severity: "high",
    tactics: ["Discovery", "Credential Access"],
    mitre: ["T1590", "T1552"],
    match: { events: ["lab.internal_metadata_read"] },
    false_positives: "Platform inventory jobs may read metadata on a fixed schedule.",
    recommendation: "Alert when metadata reads originate from application preview services or unexpected service accounts.",
  },
  {
    id: "SHIELD-S4-JWT-001",
    title: "JWT audience confusion accepted by legacy validator",
    severity: "critical",
    tactics: ["Defense Evasion", "Privilege Escalation"],
    mitre: ["T1550.001", "T1606"],
    match: { events: ["lab.legacy_audience_token_accepted"] },
    false_positives: "None expected outside controlled identity validation exercises.",
    recommendation: "Enforce issuer, audience, expiry, nonce, and service-specific authorization on every delegated token.",
  },
  {
    id: "SHIELD-S4-JWT-002",
    title: "Stale delegated token accepted",
    severity: "medium",
    tactics: ["Defense Evasion", "Privilege Escalation"],
    mitre: ["T1550.001"],
    match: { events: ["lab.stale_delegated_token_accepted"] },
    false_positives: "Short grace windows may occur during migration; long grace windows should be investigated.",
    recommendation: "Remove legacy grace acceptance or require active introspection for delegated tokens.",
  },
  {
    id: "SHIELD-S4-SVC-001",
    title: "Service account accessed shadow administration surface",
    severity: "high",
    tactics: ["Privilege Escalation", "Lateral Movement"],
    mitre: ["T1078", "T1550.001"],
    match: { events: ["lab.service_account_admin_shadow_access"] },
    false_positives: "Service inventory exports by approved admin automation.",
    recommendation: "Use service-specific scopes and deny broad service roles on privileged user data APIs.",
  },
  {
    id: "SHIELD-S4-CICD-001",
    title: "Pipeline token exposed from repository configuration",
    severity: "high",
    tactics: ["Credential Access"],
    mitre: ["T1552", "T1078"],
    match: { events: ["lab.pipeline_token_exposed"] },
    false_positives: "Synthetic lab repository reads during training.",
    recommendation: "Move pipeline credentials to scoped secret stores and scan repository configuration continuously.",
  },
  {
    id: "SHIELD-S4-CICD-002",
    title: "Token-only pipeline execution simulated",
    severity: "high",
    tactics: ["Execution", "Impact"],
    mitre: ["T1195.002", "T1078"],
    match: { events: ["lab.poisoned_build_flow_simulated"] },
    false_positives: "Approved purple-team replay or CI control testing.",
    recommendation: "Require signed workload identity, repository policy checks, branch protections, and short-lived tokens.",
  },
  {
    id: "SHIELD-S4-ARTIFACT-001",
    title: "Artifact environment metadata exposed",
    severity: "medium",
    tactics: ["Discovery", "Collection"],
    mitre: ["T1552", "T1082"],
    match: { events: ["lab.artifact_environment_exposed"] },
    false_positives: "Developer troubleshooting of artifact provenance.",
    recommendation: "Strip environment snapshots from broadly readable artifacts and scope artifact access by project.",
  },
  {
    id: "SHIELD-S4-SECRETS-001",
    title: "Legacy pipeline token read deployment secret",
    severity: "critical",
    tactics: ["Credential Access", "Collection"],
    mitre: ["T1552", "T1528"],
    match: { events: ["lab.secret_legacy_token_read"] },
    false_positives: "None expected outside controlled Stage 3 or Stage 4 exercises.",
    recommendation: "Disable token-only secret reads and require workload identity plus policy-bound approvals.",
  },
  {
    id: "SHIELD-S4-ADMIN-001",
    title: "Admin or directory route authorization failure",
    severity: "medium",
    tactics: ["Privilege Escalation", "Discovery"],
    mitre: ["T1069", "T1087"],
    match: { events: ["http.request"], path_includes: ["/directory/users", "/admin"], status_codes: [401, 403] },
    false_positives: "Users without admin rights browsing protected portals.",
    recommendation: "Correlate repeated admin denials with identity events and internal reconnaissance.",
  },
  {
    id: "SHIELD-S4-PRIVESC-001",
    title: "Identity abuse path indicates privilege escalation",
    severity: "high",
    tactics: ["Privilege Escalation"],
    mitre: ["T1550.001", "T1078"],
    match: { events: ["lab.legacy_audience_token_accepted", "lab.service_account_admin_shadow_access"] },
    false_positives: "Expected during purple-team validation only.",
    recommendation: "Centralize delegated-token validation and restrict service account administrative scopes.",
  },
  {
    id: "SHIELD-S4-RECON-001",
    title: "Internal service discovery reconnaissance",
    severity: "medium",
    tactics: ["Discovery"],
    mitre: ["T1590", "T1046"],
    match: { events: ["lab.service_discovery_dns_recon", "lab.service_discovery_map_recon"] },
    false_positives: "SOC investigation or service catalog synchronization.",
    recommendation: "Baseline service discovery usage and alert when followed by metadata, CI, or secret access.",
  },
];

const stage5DetectionRules = [
  {
    id: "SHIELD-S5-BEACON-001",
    title: "Controlled beacon heartbeat or task activity",
    severity: "high",
    tactics: ["Command and Control", "Execution"],
    mitre: ["T1071.001", "T1059"],
    match: { events: ["adversary.beacon.heartbeat", "adversary.beacon.task_polled", "adversary.beacon.task_result"] },
    false_positives: "Expected during approved Stage 5 adversary simulation exercises.",
    recommendation: "Correlate callback timing, operator identity, profile, and task type; validate command execution remains synthetic.",
  },
  {
    id: "SHIELD-S5-REDIRECTOR-001",
    title: "Redirector traffic shaping simulation",
    severity: "medium",
    tactics: ["Command and Control", "Defense Evasion"],
    mitre: ["T1090", "T1029", "T1071.001"],
    match: { events: ["adversary.redirector.route_selected", "adversary.redirector.traffic_shaped"] },
    false_positives: "Approved route validation and traffic-shaping tabletop exercises.",
    recommendation: "Preserve gateway traces, correlate route chains, and alert when redirector profiles are used outside exercise windows.",
  },
  {
    id: "SHIELD-S5-PIVOT-001",
    title: "Lateral movement path simulated across trust boundaries",
    severity: "high",
    tactics: ["Lateral Movement", "Privilege Escalation"],
    mitre: ["T1021", "T1078", "T1550.001"],
    match: { events: ["adversary.pivot.simulated", "adversary.lateral_movement.simulated"] },
    false_positives: "Approved purple-team path replay.",
    recommendation: "Review trust-boundary crossings, service account scopes, and whether the path touches privileged zones.",
  },
  {
    id: "SHIELD-S5-PERSIST-001",
    title: "Reversible persistence mechanism registered in simulation",
    severity: "high",
    tactics: ["Persistence", "Privilege Escalation"],
    mitre: ["T1053.005", "T1547", "T1543", "T1550.001"],
    match: { events: ["adversary.persistence.registered"] },
    false_positives: "Expected Stage 5 persistence visibility exercises.",
    recommendation: "Verify cleanup completion and confirm no real system-level persistence was created.",
  },
  {
    id: "SHIELD-S5-OPSEC-001",
    title: "Low-noise OPSEC profile used",
    severity: "medium",
    tactics: ["Defense Evasion", "Command and Control"],
    mitre: ["T1029", "T1071.001"],
    match: { events: ["adversary.opsec.low_noise_profile_used"] },
    false_positives: "Red-team timing profile validation.",
    recommendation: "Compare timing profile with business-hour baselines and ensure telemetry remains complete during low-noise mode.",
  },
  {
    id: "SHIELD-S5-CAMPAIGN-001",
    title: "Adversary operation campaign completed",
    severity: "high",
    tactics: ["Initial Access", "Discovery", "Credential Access", "Lateral Movement", "Collection"],
    mitre: ["T1550.001", "T1078", "T1590", "T1552", "T1119"],
    match: { events: ["adversary.operation.completed"] },
    false_positives: "Approved controlled campaign execution.",
    recommendation: "Open an exercise incident, validate timeline reconstruction, and compare generated detections to expected coverage.",
  },
  {
    id: "SHIELD-S5-REPLAY-001",
    title: "Adversary replay emitted controlled timeline",
    severity: "medium",
    tactics: ["Discovery", "Lateral Movement", "Persistence"],
    mitre: ["T1071.001", "T1021", "T1053.005"],
    match: { events: ["adversary.replay.started"] },
    false_positives: "Expected SOC replay workflow.",
    recommendation: "Use replay ID to confirm alert ordering, investigation notes, and incident reconstruction integrity.",
  },
];

const stage6DetectionRules = [
  {
    id: "SHIELD-S6-DIGITAL-TWIN-001",
    title: "Synthetic off-hours enterprise activity generated",
    severity: "medium",
    tactics: ["Defense Evasion", "Valid Accounts"],
    mitre: ["T1078", "T1029"],
    match: { events: ["digital_twin.off_hours_activity"] },
    false_positives: "Expected during Stage 6 digital twin activity generation.",
    recommendation: "Use as a baseline for off-hours anomaly hunts and verify all events carry synthetic_background_activity=true.",
  },
  {
    id: "SHIELD-S6-ATTACK-GRAPH-001",
    title: "Dynamic attack graph identified privilege paths",
    severity: "high",
    tactics: ["Discovery", "Lateral Movement", "Privilege Escalation"],
    mitre: ["T1069", "T1087", "T1021"],
    match: { events: ["stage6.attack_graph.generated", "stage6.attack_graph.privilege_path_analysis"] },
    false_positives: "Expected during graph generation and SOC visualization.",
    recommendation: "Review high-risk graph edges and prioritize service-account and CI/CD trust paths.",
  },
  {
    id: "SHIELD-S6-AUTO-CAMPAIGN-001",
    title: "Controlled autonomous campaign phase or completion",
    severity: "high",
    tactics: ["Discovery", "Credential Access", "Lateral Movement", "Collection"],
    mitre: ["T1550.001", "T1195.002", "T1552", "T1041"],
    match: { events: ["stage6.campaign.phase_completed", "stage6.campaign.completed"] },
    false_positives: "Expected only during approved Stage 6 campaign orchestration.",
    recommendation: "Validate phase ordering, replay export integrity, and detection coverage for each campaign phase.",
  },
  {
    id: "SHIELD-S6-HUNT-001",
    title: "Threat hunting query executed against telemetry",
    severity: "medium",
    tactics: ["Discovery"],
    mitre: ["T1087", "T1069"],
    match: { events: ["stage6.hunt.query_executed"] },
    false_positives: "Expected during SOC and threat-hunting exercises.",
    recommendation: "Track query context, analyst identity, and match count for hunt reproducibility.",
  },
  {
    id: "SHIELD-S6-COVERAGE-001",
    title: "Detection coverage blindspot analysis generated",
    severity: "medium",
    tactics: ["Discovery"],
    mitre: ["T1082"],
    match: { events: ["stage6.coverage.analysis_generated", "stage6.coverage.blindspot_identified"] },
    false_positives: "Expected during coverage intelligence reporting.",
    recommendation: "Prioritize telemetry blindspots with high-value service or identity blast radius.",
  },
  {
    id: "SHIELD-S6-CHAOS-001",
    title: "Security chaos simulation injected",
    severity: "high",
    tactics: ["Defense Evasion", "Impact"],
    mitre: ["T1562.008", "T1499"],
    match: { events: ["stage6.chaos.injected", "stage6.chaos.telemetry_drop_simulated", "stage6.chaos.logging_degradation_simulated"] },
    false_positives: "Expected only in scheduled resilience exercises.",
    recommendation: "Confirm chaos reversion telemetry and validate SIEM visibility during degraded states.",
  },
  {
    id: "SHIELD-S6-REPLAY-001",
    title: "Time-travel forensic reconstruction completed",
    severity: "medium",
    tactics: ["Discovery"],
    mitre: ["T1082"],
    match: { events: ["stage6.replay.reconstruction_completed"] },
    false_positives: "Expected during forensic reconstruction or replay validation.",
    recommendation: "Verify deterministic replay metadata, graph state, and detection-flow consistency.",
  },
  {
    id: "SHIELD-S6-AI-DEFENSE-001",
    title: "Defensive analysis summary generated",
    severity: "low",
    tactics: ["Discovery"],
    mitre: ["T1082"],
    match: { events: ["stage6.ai.defensive_summary_generated"] },
    false_positives: "Expected during defensive analysis workflows.",
    recommendation: "Keep analysis explainable and confirm no exploit generation or external automation occurred.",
  },
];

const stage7DetectionRules = [
  {
    id: "SHIELD-S7-K8S-GITOPS-001",
    title: "Kubernetes manifest or GitOps rollout validated",
    severity: "medium",
    tactics: ["Defense Evasion", "Execution"],
    mitre: ["T1611", "T1195.002"],
    match: { events: ["stage7.kubernetes.manifest_validated", "stage7.gitops.rollout_planned", "stage7.gitops.rollback_simulated"] },
    false_positives: "Expected during Stage 7 productionization and rollout simulations.",
    recommendation: "Review namespace segmentation, rollout stage approvals, and rollback metadata for reproducibility.",
  },
  {
    id: "SHIELD-S7-TELEMETRY-001",
    title: "Distributed telemetry trace or SLA evaluation generated",
    severity: "medium",
    tactics: ["Collection", "Lateral Movement"],
    mitre: ["T1041", "T1021"],
    match: { events: ["stage7.telemetry.trace_generated", "stage7.telemetry.sla_evaluated"] },
    false_positives: "Expected during observability validation and trace replay exercises.",
    recommendation: "Verify trace IDs, cross-service request IDs, and replay-compatible telemetry integrity markers.",
  },
  {
    id: "SHIELD-S7-RESILIENCE-001",
    title: "High availability or disaster recovery simulation completed",
    severity: "high",
    tactics: ["Impact", "Defense Evasion"],
    mitre: ["T1499", "T1562.008"],
    match: { events: ["stage7.resilience.failover_simulated", "stage7.resilience.recovery_verified"] },
    false_positives: "Expected during scheduled Stage 7 resilience exercises.",
    recommendation: "Confirm replay consistency, detection integrity, and telemetry persistence during the simulated failover window.",
  },
  {
    id: "SHIELD-S7-MULTIENV-001",
    title: "Multi-environment topology generated",
    severity: "medium",
    tactics: ["Discovery"],
    mitre: ["T1590", "T1046"],
    match: { events: ["stage7.environment.topology_generated"] },
    false_positives: "Expected when modeling subsidiaries, regions, remote workforce, or vendor trust.",
    recommendation: "Validate tenant boundaries, cross-environment trust links, and attack graph blast-radius scoring.",
  },
  {
    id: "SHIELD-S7-ZEROTRUST-001",
    title: "Zero-trust mesh policy evaluated",
    severity: "high",
    tactics: ["Lateral Movement", "Valid Accounts"],
    mitre: ["T1021", "T1550.001"],
    match: { events: ["stage7.mesh.policy_evaluated"] },
    false_positives: "Expected during service-mesh policy validation.",
    recommendation: "Review denied or approval-required paths and correlate them with service identities and mTLS posture.",
  },
  {
    id: "SHIELD-S7-GOVERNANCE-001",
    title: "Governance compliance, drift, or secret lifecycle event",
    severity: "high",
    tactics: ["Credential Access", "Valid Accounts", "Discovery"],
    mitre: ["T1552", "T1528", "T1078", "T1082"],
    match: { events: ["stage7.governance.compliance_checked", "stage7.governance.policy_drift_detected", "stage7.governance.secrets_rotation_simulated"] },
    false_positives: "Expected during governance scoring and controlled secret lifecycle simulations.",
    recommendation: "Prioritize drift affecting service-account scopes and verify secret rotation evidence remains synthetic.",
  },
  {
    id: "SHIELD-S7-DELIVERY-001",
    title: "Production CI/CD governance control executed",
    severity: "medium",
    tactics: ["Supply Chain Compromise"],
    mitre: ["T1195.002"],
    match: { events: ["stage7.delivery.artifact_verified", "stage7.delivery.image_verified", "stage7.delivery.dependency_scan_completed", "stage7.delivery.approval_recorded", "stage7.delivery.policy_validated"] },
    false_positives: "Expected during signed artifact, scan, and approval workflow exercises.",
    recommendation: "Validate the sequence of artifact verification, scan, approval, and policy validation before rollout planning.",
  },
  {
    id: "SHIELD-S7-REPLAY-001",
    title: "Enterprise-scale replay or dashboard analytics generated",
    severity: "medium",
    tactics: ["Discovery"],
    mitre: ["T1082"],
    match: { events: ["stage7.replay.export_generated", "stage7.dashboard.executive_view_generated"] },
    false_positives: "Expected during executive reporting and replay analytics workflows.",
    recommendation: "Use replay export IDs to validate deterministic timelines, governance evidence, and telemetry continuity.",
  },
];

function activeDetectionRules() {
  const rules = [...detectionRules];
  if (process.env.STAGE5_TARGETS_ENABLED === "true") {
    rules.push(...stage5DetectionRules);
  }
  if (process.env.STAGE6_TARGETS_ENABLED === "true") {
    rules.push(...stage6DetectionRules);
  }
  if (process.env.STAGE7_TARGETS_ENABLED === "true") {
    rules.push(...stage7DetectionRules);
  }
  return rules;
}

function validationDetectionRules(stage = "stage4") {
  if (stage === "stage5") {
    return stage5DetectionRules;
  }
  if (stage === "stage6") {
    return stage6DetectionRules;
  }
  if (stage === "stage7") {
    return stage7DetectionRules;
  }
  if (stage === "all") {
    return activeDetectionRules();
  }
  return detectionRules;
}

function findDetectionRuleForEvent(eventName) {
  return activeDetectionRules().find((rule) => rule.match.events?.includes(eventName));
}

const triageNotes = [];
const replayCatalog = [
  {
    id: "stage3-identity-devops-secrets-chain",
    name: "Stage 3 identity to CI to secrets telemetry replay",
    events: [
      "lab.identity.audience_confusion_token_issued",
      "lab.legacy_audience_token_accepted",
      "lab.service_discovery_dns_recon",
      "lab.ssrf_internal_service_preview",
      "lab.pipeline_token_exposed",
      "lab.poisoned_build_flow_simulated",
      "lab.artifact_environment_exposed",
      "lab.secret_legacy_token_read",
    ],
  },
];

function severityScore(severity) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[String(severity || "").toLowerCase()] || 0;
}

function maxSeverity(values) {
  return values.reduce((current, next) => (severityScore(next) > severityScore(current) ? next : current), "low");
}

function stableId(prefix, parts) {
  return `${prefix}-${crypto.createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 12)}`;
}

function normalizeTelemetryEvent(event) {
  const observedAt = event.timestamp || event.received_at || new Date().toISOString();
  const eventName = event.event || "unknown.event";
  const eventId = event.event_id || event.collector_request_id || stableId("evt", [eventName, event.request_id, observedAt]);
  return {
    event_id: eventId,
    event_name: eventName,
    observed_at: observedAt,
    source_service: event.service || event.caller || "unknown",
    source_mode: event.mode || "unknown",
    request_id: event.request_id || event.collector_request_id || null,
    principal: event.principal || event.caller || "unknown",
    status_code: event.status_code || null,
    path: event.path || event.route || event.original_uri || null,
    severity: event.severity || "informational",
    mitre: Array.isArray(event.mitre) ? event.mitre : [],
    lab_stage: event.lab_stage || null,
    attack_simulation: Boolean(event.attack_simulation || event.lab_stage || event.replay_id),
    replay_id: event.replay_id || null,
    raw: event,
  };
}

function ruleMatchesEvent(rule, normalizedEvent) {
  const raw = normalizedEvent.raw || {};
  const eventMatch = !rule.match.events || rule.match.events.includes(normalizedEvent.event_name);
  const pathMatch =
    !rule.match.path_includes ||
    rule.match.path_includes.some((fragment) => String(normalizedEvent.path || raw.path || raw.original_uri || "").includes(fragment));
  const statusMatch = !rule.match.status_codes || rule.match.status_codes.includes(Number(normalizedEvent.status_code || raw.status_code || 0));
  return eventMatch && pathMatch && statusMatch;
}

function alertFromRule(rule, normalizedEvent) {
  const stageTag = rule.id.startsWith("SHIELD-S7") ? "stage7" : rule.id.startsWith("SHIELD-S6") ? "stage6" : rule.id.startsWith("SHIELD-S5") ? "stage5" : "stage4";
  return {
    alert_id: stableId("alert", [rule.id, normalizedEvent.event_id, normalizedEvent.request_id]),
    rule_id: rule.id,
    title: rule.title,
    severity: rule.severity,
    status: "open",
    tactics: rule.tactics,
    mitre: rule.mitre,
    source_service: normalizedEvent.source_service,
    principal: normalizedEvent.principal,
    event_name: normalizedEvent.event_name,
    event_id: normalizedEvent.event_id,
    request_id: normalizedEvent.request_id,
    observed_at: normalizedEvent.observed_at,
    false_positive_notes: rule.false_positives,
    recommendation: rule.recommendation,
    tags: ["shield-pdp", stageTag, "detection-engine", ...(normalizedEvent.attack_simulation ? ["attack-simulation"] : [])],
  };
}

function detectAlerts(events) {
  const normalizedEvents = events.map(normalizeTelemetryEvent);
  const rules = activeDetectionRules();
  const alerts = [];
  for (const event of normalizedEvents) {
    for (const rule of rules) {
      if (ruleMatchesEvent(rule, event)) {
        alerts.push(alertFromRule(rule, event));
      }
    }
  }
  return alerts.sort((left, right) => String(right.observed_at).localeCompare(String(left.observed_at)));
}

async function fetchJsonWithServiceAuth(url, options = {}) {
  const token = await getServiceToken();
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-request-id": options.requestId || crypto.randomUUID(),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs || 3500),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return body;
}

async function fetchLogEvents(limit = 500) {
  if (SERVICE_MODE === "log") {
    return memoryEvents.slice(-limit).reverse();
  }
  const body = await fetchJsonWithServiceAuth(`${LOG_COLLECTOR_URL}/events/export?limit=${Math.min(Math.max(limit, 1), 1000)}`);
  return Array.isArray(body.events) ? body.events : [];
}

function wazuhAlertFromDetection(alert) {
  return {
    id: alert.alert_id,
    timestamp: alert.observed_at,
    rule: {
      id: alert.rule_id,
      level: { low: 3, medium: 7, high: 10, critical: 12 }[alert.severity] || 5,
      description: alert.title,
      mitre: { id: alert.mitre, tactic: alert.tactics },
    },
    agent: { name: alert.source_service, type: "shield-pdp-lab-service" },
    data: {
      principal: alert.principal,
      request_id: alert.request_id,
      event_name: alert.event_name,
      recommendation: alert.recommendation,
    },
  };
}

function opensearchDocumentFromEvent(event) {
  const normalized = normalizeTelemetryEvent(event);
  return {
    "@timestamp": normalized.observed_at,
    event: { id: normalized.event_id, action: normalized.event_name, kind: normalized.attack_simulation ? "alert" : "event" },
    service: { name: normalized.source_service },
    user: { name: normalized.principal },
    http: { response: { status_code: normalized.status_code } },
    url: { path: normalized.path },
    labels: {
      request_id: normalized.request_id,
      lab_stage: normalized.lab_stage,
      replay_id: normalized.replay_id,
    },
    threat: { technique: normalized.mitre.map((id) => ({ id })) },
    shield: normalized,
  };
}

function buildTimeline(events, alerts) {
  const alertByEvent = new Map();
  for (const alert of alerts) {
    const list = alertByEvent.get(alert.event_id) || [];
    list.push({ alert_id: alert.alert_id, rule_id: alert.rule_id, severity: alert.severity, title: alert.title });
    alertByEvent.set(alert.event_id, list);
  }
  return events
    .map(normalizeTelemetryEvent)
    .sort((left, right) => String(left.observed_at).localeCompare(String(right.observed_at)))
    .map((event, index) => ({
      sequence: index + 1,
      observed_at: event.observed_at,
      event_id: event.event_id,
      event_name: event.event_name,
      source_service: event.source_service,
      principal: event.principal,
      request_id: event.request_id,
      mitre: event.mitre,
      alerts: alertByEvent.get(event.event_id) || [],
    }));
}

function buildIncidents(alerts) {
  const relevant = alerts.filter((alert) => alert.tags.includes("attack-simulation") || alert.severity === "critical" || alert.severity === "high");
  const grouped = new Map();
  for (const alert of relevant) {
    const key = alert.principal === "anonymous" ? "anonymous-token-path" : alert.principal || "unknown-principal";
    const list = grouped.get(key) || [];
    list.push(alert);
    grouped.set(key, list);
  }

  return [...grouped.entries()].map(([principal, principalAlerts]) => {
    const sorted = principalAlerts.sort((left, right) => String(left.observed_at).localeCompare(String(right.observed_at)));
    const severity = maxSeverity(sorted.map((alert) => alert.severity));
    const techniques = [...new Set(sorted.flatMap((alert) => alert.mitre))].sort();
    const tactics = [...new Set(sorted.flatMap((alert) => alert.tactics))].sort();
    const incidentId = stableId("inc", [principal, sorted.map((alert) => alert.rule_id).join(","), sorted[0]?.observed_at || ""]);
    return {
      incident_id: incidentId,
      title: `Correlated identity and infrastructure abuse for ${principal}`,
      severity,
      status: "open",
      principal,
      first_seen: sorted[0]?.observed_at || null,
      last_seen: sorted[sorted.length - 1]?.observed_at || null,
      alert_count: sorted.length,
      alerts: sorted.map((alert) => alert.alert_id),
      rule_ids: [...new Set(sorted.map((alert) => alert.rule_id))].sort(),
      mitre: techniques,
      tactics,
      triage_notes: triageNotes.filter((note) => note.incident_id === incidentId),
    };
  });
}

function summarizeIdentityAbuse(alerts) {
  const byPrincipal = {};
  for (const alert of alerts) {
    const principal = alert.principal || "unknown";
    byPrincipal[principal] ||= { principal, alert_count: 0, severities: {}, techniques: new Set(), rules: new Set() };
    byPrincipal[principal].alert_count += 1;
    byPrincipal[principal].severities[alert.severity] = (byPrincipal[principal].severities[alert.severity] || 0) + 1;
    alert.mitre.forEach((technique) => byPrincipal[principal].techniques.add(technique));
    byPrincipal[principal].rules.add(alert.rule_id);
  }
  return Object.values(byPrincipal).map((item) => ({
    principal: item.principal,
    alert_count: item.alert_count,
    severities: item.severities,
    techniques: [...item.techniques].sort(),
    rules: [...item.rules].sort(),
  }));
}

async function currentAlerts(limit = 500) {
  const events = await fetchLogEvents(limit);
  return detectAlerts(events);
}

function registerSiemRoutes() {
  const guard = requireRoles(["admin", "soc_analyst", "detection_engineer", "red_team_operator", "service_siem", "service_observability"]);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/pipeline/status", "/api/normalized-events", "/api/wazuh/alerts", "/api/opensearch/bulk"] });
  });

  app.get("/api/pipeline/status", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.query.limit || 500));
      const alerts = detectAlerts(events);
      res.json({
        pipeline: "shield-pdp-stage4-siem-bridge",
        raw_events: events.length,
        normalized_events: events.length,
        detection_alerts: alerts.length,
        integrations: {
          wazuh: { status: "schema-compatible", endpoint: "/api/wazuh/alerts" },
          opensearch: { status: "bulk-compatible", endpoint: "/api/opensearch/bulk.ndjson" },
        },
        request_id: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/normalized-events", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.query.limit || 500));
      res.json({ events: events.map(normalizeTelemetryEvent), request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/wazuh/alerts", guard, async (req, res, next) => {
    try {
      const alerts = detectAlerts(await fetchLogEvents(Number(req.query.limit || 500))).map(wazuhAlertFromDetection);
      res.json({ integration: "wazuh", alerts, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/opensearch/bulk", guard, async (req, res, next) => {
    try {
      const documents = (await fetchLogEvents(Number(req.query.limit || 500))).map(opensearchDocumentFromEvent);
      res.json({ integration: "opensearch", index: "shield-pdp-stage4-events", documents, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/opensearch/bulk.ndjson", guard, async (req, res, next) => {
    try {
      const lines = [];
      for (const document of (await fetchLogEvents(Number(req.query.limit || 500))).map(opensearchDocumentFromEvent)) {
        lines.push(JSON.stringify({ index: { _index: "shield-pdp-stage4-events", _id: document.event.id } }));
        lines.push(JSON.stringify(document));
      }
      res.type("application/x-ndjson").send(`${lines.join("\n")}\n`);
    } catch (error) {
      next(error);
    }
  });
}

function registerDetectionRoutes() {
  const guard = requireRoles(["admin", "soc_analyst", "detection_engineer", "red_team_operator", "service_detection", "service_observability", "service_correlation", "service_soc"]);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/rules", "/api/alerts", "/api/validation/run"] });
  });

  app.get("/api/rules", guard, (req, res) => {
    res.json({ rules: activeDetectionRules(), request_id: req.requestId });
  });

  app.get("/api/alerts", guard, async (req, res, next) => {
    try {
      const alerts = await currentAlerts(Number(req.query.limit || 500));
      res.json({ alerts, total: alerts.length, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/internal/alerts/export", guard, async (req, res, next) => {
    try {
      const alerts = await currentAlerts(Number(req.query.limit || 500));
      res.json({ alerts, exported_at: new Date().toISOString(), request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/validation/run", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.body.limit || 500));
      const alerts = detectAlerts(events);
      const observedRules = new Set(alerts.map((alert) => alert.rule_id));
      const stage = String(req.body.stage || req.query.stage || "stage4");
      const rules = validationDetectionRules(stage);
      const validationRuleIds = new Set(rules.map((rule) => rule.id));
      const matchedRules = [...observedRules].filter((ruleId) => validationRuleIds.has(ruleId));
      const result = {
        run_id: stableId("detval", [Date.now().toString(), req.requestId]),
        status: "completed",
        stage,
        evaluated_events: events.length,
        evaluated_rules: rules.length,
        observed_rules: matchedRules.length,
        missing_rules: rules.filter((rule) => !observedRules.has(rule.id)).map((rule) => rule.id),
        coverage_percent: Number(((matchedRules.length / rules.length) * 100).toFixed(2)),
      };
      recordLabEvent(req, "purple.detection_validation_completed", {
        severity: "low",
        mitre: [],
        validation_run_id: result.run_id,
        observed_rules: result.observed_rules,
      });
      res.json({ validation: result, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });
}

function registerCorrelationRoutes() {
  const guard = requireRoles(["admin", "soc_analyst", "detection_engineer", "red_team_operator", "service_correlation", "service_observability", "service_soc"]);

  app.get("/", guard, (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/api/timeline", "/api/attack-paths", "/api/identity-abuse"] });
  });

  app.get("/api/timeline", guard, async (req, res, next) => {
    try {
      const events = await fetchLogEvents(Number(req.query.limit || 500));
      const alerts = detectAlerts(events);
      res.json({ timeline: buildTimeline(events, alerts), request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/attack-paths", guard, async (req, res, next) => {
    try {
      const alerts = await currentAlerts(Number(req.query.limit || 500));
      res.json({ incidents: buildIncidents(alerts), request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/identity-abuse", guard, async (req, res, next) => {
    try {
      const alerts = await currentAlerts(Number(req.query.limit || 500));
      res.json({ principals: summarizeIdentityAbuse(alerts), request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/internal/incidents/export", guard, async (req, res, next) => {
    try {
      const alerts = await currentAlerts(Number(req.query.limit || 500));
      res.json({ incidents: buildIncidents(alerts), exported_at: new Date().toISOString(), request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });
}

function registerSocDashboardRoutes() {
  const guard = requireRoles(["admin", "soc_analyst", "detection_engineer", "red_team_operator"]);

  app.get("/", guard, (req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shield-PDP SOC</title>
  <style>
    body{margin:0;background:#0f172a;color:#e5e7eb;font-family:Inter,system-ui,sans-serif}
    main{max-width:1120px;margin:0 auto;padding:24px}
    section{border-top:1px solid #334155;padding:16px 0}
    code{color:#93c5fd}
    pre{white-space:pre-wrap;background:#111827;border:1px solid #334155;border-radius:8px;padding:14px}
  </style>
</head>
<body>
  <main>
    <h1>Shield-PDP SOC</h1>
    <section><p>Analyst: <code>${req.principal.sub || req.principal.username}</code></p></section>
    <section><pre>${JSON.stringify({ endpoints: ["/api/incidents", "/api/workflow", "/api/replay/stage3-attack-chain", "/api/replay/adversary-timeline"] }, null, 2)}</pre></section>
  </main>
</body>
</html>`);
  });

  app.get("/api/workflow", guard, (req, res) => {
    res.json({
      workflow: {
        queue: "open incidents from correlation-engine",
        triage_states: ["open", "investigating", "benign", "confirmed", "closed"],
        roles: ["soc_analyst", "admin", "detection_engineer", "red_team_operator"],
        validation: "detection and adversary replay emit synthetic, local telemetry only",
        stage5_replay: process.env.STAGE5_TARGETS_ENABLED === "true" ? "enabled" : "disabled",
      },
      request_id: req.requestId,
    });
  });

  app.get("/api/incidents", guard, async (req, res, next) => {
    try {
      const body = await fetchJsonWithServiceAuth(`${CORRELATION_ENGINE_URL}/internal/incidents/export?limit=${Number(req.query.limit || 500)}`, {
        requestId: req.requestId,
      });
      res.json({ incidents: body.incidents || [], triage_notes: triageNotes, request_id: req.requestId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/incidents/:incidentId/triage", guard, (req, res) => {
    const note = {
      note_id: stableId("note", [req.params.incidentId, req.requestId]),
      incident_id: req.params.incidentId,
      author: req.principal.sub || req.principal.username,
      status: req.body.status || "investigating",
      note: String(req.body.note || "Stage 4 triage update").slice(0, 1000),
      created_at: new Date().toISOString(),
    };
    triageNotes.push(note);
    recordLabEvent(req, "purple.incident_triage_updated", {
      severity: "low",
      mitre: [],
      incident_id: note.incident_id,
      triage_status: note.status,
    });
    res.status(201).json({ note, request_id: req.requestId });
  });

  app.post("/api/replay/stage3-attack-chain", guard, (req, res) => {
    const replay = replayCatalog[0];
    const replayId = stableId("replay", [req.requestId, Date.now().toString()]);
    replay.events.forEach((eventName, index) => {
      emitTelemetry({
        event: eventName,
        event_id: stableId("evt", [replayId, eventName, String(index)]),
        request_id: req.requestId,
        principal: req.principal.sub || req.principal.username,
        lab_stage: "stage4-purple-team-replay",
        severity: index >= replay.events.length - 2 ? "high" : "medium",
        mitre: findDetectionRuleForEvent(eventName)?.mitre || [],
        attack_simulation: true,
        replay_id: replayId,
        replay_step: index + 1,
      });
    });
    res.status(202).json({
      replay_id: replayId,
      replay: replay.id,
      emitted_events: replay.events.length,
      controls: { destructive_actions: false, command_execution: false, external_callbacks: false },
      request_id: req.requestId,
    });
  });

  app.get("/api/replay/adversary-timeline", guard, async (req, res, next) => {
    if (process.env.STAGE5_TARGETS_ENABLED !== "true") {
      return res.status(409).json({ error: "stage5_replay_disabled", request_id: req.requestId });
    }
    try {
      const body = await fetchJsonWithServiceAuth(`${ADVERSARY_CONTROL_URL}/api/replay/adversary-timeline`, {
        requestId: req.requestId,
      });
      return res.json({ ...body, request_id: req.requestId });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/replay/adversary-timeline", guard, async (req, res, next) => {
    if (process.env.STAGE5_TARGETS_ENABLED !== "true") {
      return res.status(409).json({ error: "stage5_replay_disabled", request_id: req.requestId });
    }
    try {
      const body = await fetchJsonWithServiceAuth(`${ADVERSARY_CONTROL_URL}/api/replay/adversary-timeline`, {
        method: "POST",
        body: req.body || {},
        requestId: req.requestId,
      });
      return res.status(202).json({ ...body, request_id: req.requestId });
    } catch (error) {
      return next(error);
    }
  });
}

function appendEvent(event) {
  const safeEvent = {
    received_at: new Date().toISOString(),
    collector: SERVICE_NAME,
    ...event,
  };
  memoryEvents.push(safeEvent);
  while (memoryEvents.length > MAX_MEMORY_EVENTS) {
    memoryEvents.shift();
  }

  try {
    const directory = path.dirname(EVENT_STORE_PATH);
    fs.mkdirSync(directory, { recursive: true });
    fs.appendFileSync(EVENT_STORE_PATH, `${JSON.stringify(safeEvent)}\n`, "utf8");
  } catch (error) {
    log("WARN", "Event store append failed; retaining event in memory.", {
      event: "log_collector.event_store_failed",
      event_store: EVENT_STORE_PATH,
      error: error.message,
    });
  }
  return safeEvent;
}

function registerLogCollectorRoutes() {
  app.get("/", (req, res) => {
    res.json({ service: SERVICE_NAME, mode: SERVICE_MODE, endpoints: ["/ingest", "/events", "/events/summary"] });
  });

  app.post("/ingest", async (req, res) => {
    const token = tokenFromRequest(req);
    const internalToken = req.get("x-internal-log-token");
    let accepted = false;
    let caller = "unknown";

    if (token) {
      try {
        const claims = verifyJwt(token);
        const scopes = String(claims.scope || "").split(" ");
        accepted = scopes.includes("telemetry:write") || (claims.roles || []).includes("service_observability");
        caller = claims.client_id || claims.sub || "token-principal";
      } catch (error) {
        accepted = false;
      }
    } else if (internalToken && constantTimeEqual(internalToken, LOG_INGEST_TOKEN)) {
      accepted = true;
      caller = req.get("x-service-name") || "bootstrap-service";
    }

    if (!accepted) {
      counters.authFailuresTotal += 1;
      return res.status(401).json({ error: "telemetry_auth_failed", request_id: req.requestId });
    }

    const stored = appendEvent({
      ...req.body,
      collector_request_id: req.requestId,
      caller,
    });
    return res.status(202).json({ status: "accepted", request_id: req.requestId, event_id: stored.event_id || stored.jti || null });
  });

  app.get("/events", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 250);
    res.json({ events: memoryEvents.slice(-limit).reverse() });
  });

  app.get(
    "/events/export",
    requireRoles([
      "admin",
      "soc_analyst",
      "service_observability",
      "service_detection",
      "service_correlation",
      "service_siem",
      "service_soc",
    ]),
    (req, res) => {
      const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 1000);
      res.json({
        events: memoryEvents.slice(-limit).reverse(),
        exported_at: new Date().toISOString(),
        request_id: req.requestId,
      });
    },
  );

  app.get("/events/summary", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    const byService = {};
    for (const event of memoryEvents) {
      const service = event.service || "unknown";
      byService[service] = (byService[service] || 0) + 1;
    }
    res.json({
      buffered_events: memoryEvents.length,
      event_store: EVENT_STORE_PATH,
      services: byService,
    });
  });
}

function serviceTargets() {
  const stage2Targets = [
    "auth-service=http://auth-service:8080",
    "employee-portal=http://employee-portal:8080",
    "hr-portal=http://hr-portal:8080",
    "finance-portal=http://finance-portal:8080",
    "internal-admin-dashboard=http://internal-admin-dashboard:8080",
    "developer-dashboard=http://developer-dashboard:8080",
    "log-collector=http://log-collector:8080",
  ];
  const stage3Targets = [
    "internal-api=http://internal-api:8080",
    "service-discovery=http://service-discovery:8080",
    "git-sim=http://git-sim:8080",
    "ci-sim=http://ci-sim:8080",
    "artifact-store=http://artifact-store:8080",
    "secrets-broker=http://secrets-broker:8080",
  ];
  const stage4Targets = [
    "siem-bridge=http://siem-bridge:8080",
    "detection-engine=http://detection-engine:8080",
    "correlation-engine=http://correlation-engine:8080",
    "soc-dashboard=http://soc-dashboard:8080",
  ];
  const stage5Targets = [
    "adversary-control=http://adversary-control:8080",
    "beacon-sim=http://beacon-sim:8080",
    "redirector-sim=http://redirector-sim:8080",
    "pivot-sim=http://pivot-sim:8080",
    "persistence-sim=http://persistence-sim:8080",
  ];
  const stage6Targets = [
    "digital-twin=http://digital-twin:8080",
    "attack-graph=http://attack-graph:8080",
    "campaign-orchestrator=http://campaign-orchestrator:8080",
    "threat-hunting=http://threat-hunting:8080",
    "coverage-intel=http://coverage-intel:8080",
    "chaos-sim=http://chaos-sim:8080",
    "intelligence-dashboard=http://intelligence-dashboard:8080",
  ];
  const stage7Targets = [
    "kubernetes-orchestrator=http://kubernetes-orchestrator:8080",
    "gitops-controller=http://gitops-controller:8080",
    "telemetry-fabric=http://telemetry-fabric:8080",
    "resilience-hub=http://resilience-hub:8080",
    "environment-manager=http://environment-manager:8080",
    "zero-trust-mesh=http://zero-trust-mesh:8080",
    "governance-engine=http://governance-engine:8080",
    "delivery-governance=http://delivery-governance:8080",
    "scale-dashboard=http://scale-dashboard:8080",
  ];
  const defaultTargets = [
    ...stage2Targets,
    ...(process.env.STAGE3_TARGETS_ENABLED === "true" ? stage3Targets : []),
    ...(process.env.STAGE4_TARGETS_ENABLED === "true" ? stage4Targets : []),
    ...(process.env.STAGE5_TARGETS_ENABLED === "true" ? stage5Targets : []),
    ...(process.env.STAGE6_TARGETS_ENABLED === "true" ? stage6Targets : []),
    ...(process.env.STAGE7_TARGETS_ENABLED === "true" ? stage7Targets : []),
  ];
  const raw = process.env.SERVICE_TARGETS || defaultTargets.join(",");

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [name, url] = item.split("=");
      return { name, url: String(url || "").replace(/\/$/, "") };
    })
    .filter((item) => item.name && item.url);
}

async function checkTarget(target) {
  const started = Date.now();
  try {
    const response = await fetch(`${target.url}/health`, {
      headers: { "x-request-id": crypto.randomUUID() },
      signal: AbortSignal.timeout(2500),
    });
    return {
      name: target.name,
      url: target.url,
      status: response.ok ? "healthy" : "degraded",
      http_status: response.status,
      latency_ms: Date.now() - started,
    };
  } catch (error) {
    return {
      name: target.name,
      url: target.url,
      status: "unreachable",
      error: error.message,
      latency_ms: Date.now() - started,
    };
  }
}

function registerObservabilityRoutes() {
  app.get("/", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    res.json({
      service: SERVICE_NAME,
      mode: SERVICE_MODE,
      endpoints: ["/service-health", "/topology", "/metrics"],
      principal: req.principal.sub,
    });
  });

  app.get("/service-health", requireRoles(["admin", "soc_analyst"]), async (req, res) => {
    const results = await Promise.all(serviceTargets().map(checkTarget));
    res.json({
      checked_at: new Date().toISOString(),
      services: results,
      healthy: results.filter((item) => item.status === "healthy").length,
      total: results.length,
    });
  });

  app.get("/topology", requireRoles(["admin", "soc_analyst"]), (req, res) => {
    res.json({
      zones: [
        { name: "edge", services: ["enterprise-gateway"], trust: "north-south routing" },
        { name: "identity", services: ["auth-service", "vault-sim", "secrets-broker"], trust: "token issuance, validation, and secret policy simulation" },
        { name: "enterprise", services: ["employee-portal", "hr-portal", "finance-portal", "internal-admin-dashboard", "developer-dashboard", "internal-api", "service-discovery"], trust: "role-gated business workflows and internal trust boundaries" },
        { name: "devops", services: ["git-sim", "ci-sim", "artifact-store"], trust: "source, pipeline, artifact, and deployment relationships" },
        { name: "data", services: ["db", "enterprise-redis", "enterprise-rabbitmq"], trust: "state, queues, and persistence" },
        { name: "observability", services: ["log-collector", "observability-api", "siem-bridge", "detection-engine", "correlation-engine", "soc-dashboard", "soc-node"], trust: "centralized telemetry, detections, correlation, and SOC workflow" },
        { name: "adversary-operations", services: ["adversary-control", "beacon-sim", "redirector-sim", "pivot-sim", "persistence-sim"], trust: "controlled red-team simulation, replay, and safety telemetry" },
        { name: "intelligence", services: ["digital-twin", "attack-graph", "campaign-orchestrator", "threat-hunting", "coverage-intel", "chaos-sim", "intelligence-dashboard"], trust: "digital twin, attack graph, hunting, coverage, chaos, and executive intelligence" },
        { name: "production-scale", services: ["kubernetes-orchestrator", "gitops-controller", "telemetry-fabric", "resilience-hub", "environment-manager", "zero-trust-mesh", "governance-engine", "delivery-governance", "scale-dashboard"], trust: "Kubernetes, GitOps, distributed telemetry, resilience, zero trust, governance, and enterprise-scale operations" },
      ],
      service_targets: serviceTargets(),
      stage_urls: {
        adversary_control: ADVERSARY_CONTROL_URL,
        beacon_sim: BEACON_SIM_URL,
        redirector_sim: REDIRECTOR_SIM_URL,
        pivot_sim: PIVOT_SIM_URL,
        persistence_sim: PERSISTENCE_SIM_URL,
        digital_twin: DIGITAL_TWIN_URL,
        attack_graph: ATTACK_GRAPH_URL,
        campaign_orchestrator: CAMPAIGN_ORCHESTRATOR_URL,
        threat_hunting: THREAT_HUNTING_URL,
        coverage_intel: COVERAGE_INTEL_URL,
        chaos_sim: CHAOS_SIM_URL,
        intelligence_dashboard: INTELLIGENCE_DASHBOARD_URL,
        kubernetes_orchestrator: KUBERNETES_ORCHESTRATOR_URL,
        gitops_controller: GITOPS_CONTROLLER_URL,
        telemetry_fabric: TELEMETRY_FABRIC_URL,
        resilience_hub: RESILIENCE_HUB_URL,
        environment_manager: ENVIRONMENT_MANAGER_URL,
        zero_trust_mesh: ZERO_TRUST_MESH_URL,
        governance_engine: GOVERNANCE_ENGINE_URL,
        delivery_governance: DELIVERY_GOVERNANCE_URL,
        scale_dashboard: SCALE_DASHBOARD_URL,
      },
    });
  });
}

if (SERVICE_MODE === "auth") {
  registerAuthRoutes();
} else if (SERVICE_MODE === "log") {
  registerLogCollectorRoutes();
} else if (SERVICE_MODE === "observability") {
  registerObservabilityRoutes();
} else if (SERVICE_MODE === "internal-api") {
  registerInternalApiRoutes();
} else if (SERVICE_MODE === "service-discovery") {
  registerServiceDiscoveryRoutes();
} else if (SERVICE_MODE === "git") {
  registerGitRoutes();
} else if (SERVICE_MODE === "ci") {
  registerCiRoutes();
} else if (SERVICE_MODE === "artifact") {
  registerArtifactRoutes();
} else if (SERVICE_MODE === "secrets") {
  registerSecretsRoutes();
} else if (SERVICE_MODE === "siem") {
  registerSiemRoutes();
} else if (SERVICE_MODE === "detection") {
  registerDetectionRoutes();
} else if (SERVICE_MODE === "correlation") {
  registerCorrelationRoutes();
} else if (SERVICE_MODE === "soc-dashboard") {
  registerSocDashboardRoutes();
} else if (SERVICE_MODE === "adversary-control") {
  registerAdversaryControlRoutes();
} else if (SERVICE_MODE === "beacon-sim") {
  registerBeaconRoutes();
} else if (SERVICE_MODE === "redirector-sim") {
  registerRedirectorRoutes();
} else if (SERVICE_MODE === "pivot-sim") {
  registerPivotRoutes();
} else if (SERVICE_MODE === "persistence-sim") {
  registerPersistenceRoutes();
} else if (SERVICE_MODE === "digital-twin") {
  registerDigitalTwinRoutes();
} else if (SERVICE_MODE === "attack-graph") {
  registerAttackGraphRoutes();
} else if (SERVICE_MODE === "campaign-orchestrator") {
  registerCampaignOrchestratorRoutes();
} else if (SERVICE_MODE === "threat-hunting") {
  registerThreatHuntingRoutes();
} else if (SERVICE_MODE === "coverage-intel") {
  registerCoverageIntelRoutes();
} else if (SERVICE_MODE === "chaos-sim") {
  registerChaosRoutes();
} else if (SERVICE_MODE === "intelligence-dashboard") {
  registerIntelligenceDashboardRoutes();
} else if (SERVICE_MODE === "kubernetes-orchestrator") {
  registerKubernetesOrchestratorRoutes();
} else if (SERVICE_MODE === "gitops-controller") {
  registerGitOpsControllerRoutes();
} else if (SERVICE_MODE === "telemetry-fabric") {
  registerTelemetryFabricRoutes();
} else if (SERVICE_MODE === "resilience-hub") {
  registerResilienceHubRoutes();
} else if (SERVICE_MODE === "environment-manager") {
  registerEnvironmentManagerRoutes();
} else if (SERVICE_MODE === "zero-trust-mesh") {
  registerZeroTrustMeshRoutes();
} else if (SERVICE_MODE === "governance-engine") {
  registerGovernanceEngineRoutes();
} else if (SERVICE_MODE === "delivery-governance") {
  registerDeliveryGovernanceRoutes();
} else if (SERVICE_MODE === "scale-dashboard") {
  registerScaleDashboardRoutes();
} else if (["employee", "hr", "finance", "admin", "developer"].includes(SERVICE_MODE)) {
  registerPortalRoutes(SERVICE_MODE);
} else {
  throw new Error(`Unsupported SERVICE_MODE: ${SERVICE_MODE}`);
}

app.use((req, res) => {
  res.status(404).json({ error: "not_found", service: SERVICE_NAME, request_id: req.requestId });
});

app.use((error, req, res, next) => {
  counters.errorsTotal += 1;
  log("ERROR", "Unhandled service error.", {
    event: "service.unhandled_error",
    request_id: req.requestId,
    error: error.message,
  });
  res.status(500).json({ error: "internal_error", request_id: req.requestId });
});

app.listen(PORT, "0.0.0.0", () => {
  log("INFO", "Enterprise core service started.", {
    event: "service.started",
    port: PORT,
    issuer: ISSUER,
  });
});

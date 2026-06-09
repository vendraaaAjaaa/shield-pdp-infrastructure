# Threat Hunting Playbook: API Data Exfiltration Attempts

## Objective
Identify IDOR, BOLA, and admin-route probes against personal-data APIs and confirm that controls block unauthorized access.

## Data Sources
- Nginx gateway JSON access logs from `shield-pdp-proxy`.
- FastAPI structured application logs.
- `audit_events` table in PostgreSQL.
- Red-team validation output at `reports/pentest/redteam_validation.json`.

## Hunting Queries

### Blocked Profile Or Account Probes
```kibana
GET /shield-pdp-gateway-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "terms": { "status": [403] } },
        { "wildcard": { "uri": "/api/v1/vulnerable/profiles/*" } }
      ]
    }
  }
}
```

### Unauthorized Admin Attempts
```kibana
GET /shield-pdp-gateway-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "term": { "status": 403 } },
        { "wildcard": { "uri": "/api/v1/vulnerable/admin/*" } }
      ]
    }
  }
}
```

### API Or Gateway 5xx
```kibana
GET /shield-pdp-gateway-*/_search
{
  "query": {
    "range": { "status": { "gte": 500 } }
  }
}
```

## Investigation Steps
1. Pivot on `request_id` from Nginx logs into API structured logs.
2. Confirm the actor and outcome in `audit_events`.
3. Distinguish planned validation runs from unexpected source IPs or user agents.
4. Check `docker compose ps` and `/ready` if gateway 5xx responses appear.

## Remediation
1. Keep object authorization and RBAC enabled on sensitive routes.
2. Rotate credentials for accounts involved in unexpected probes.
3. Preserve audit evidence for UU PDP reporting.
4. Escalate repeated unauthorized attempts to incident response.

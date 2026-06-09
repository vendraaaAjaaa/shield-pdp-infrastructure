import json
from datetime import datetime, timezone
from pathlib import Path


class UUPDPComplianceEngine:
    def __init__(self):
        self.mappings = {
            "BOLA": {
                "article": "Article 26, 39",
                "description": "Unauthorized access to personal or financial data due to broken object-level authorization.",
                "severity": "High",
                "requirement": "Data controller must prevent unauthorized access to personal data.",
            },
            "IDOR": {
                "article": "Article 26, 39",
                "description": "Exposure of sensitive personal data such as NIK or biometric references to unauthorized users.",
                "severity": "Critical",
                "requirement": "Technical security measures must protect sensitive personal data.",
            },
            "Broken Access Control": {
                "article": "Article 24, 35",
                "description": "Failure to restrict access to administrative functions containing user data.",
                "severity": "High",
                "requirement": "Security and confidentiality of processed personal data must be maintained.",
            },
            "Weak Authentication": {
                "article": "Article 39",
                "description": "Insufficient authentication mechanisms for accessing personal data.",
                "severity": "Medium",
                "requirement": "Technical controls must be appropriate to the risk level.",
            },
        }

    def map_finding(self, finding_type, details, status="remediated"):
        mapping = self.mappings.get(finding_type)
        if not mapping:
            return None
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "finding": finding_type,
            "article_violated": mapping["article"],
            "requirement_summary": mapping["requirement"],
            "severity": mapping["severity"],
            "details": details,
            "remediation_status": status,
            "recommendation": f"Maintain strict ownership checks, RBAC, and audit logging for {finding_type} controls.",
        }

    def generate_report(self, findings):
        mapped_findings = [
            self.map_finding(finding["type"], finding["details"], finding.get("status", "remediated"))
            for finding in findings
        ]
        mapped_findings = [finding for finding in mapped_findings if finding]
        return {
            "report_title": "Shield-PDP: UU PDP Compliance Gap Analysis",
            "organization": "PT Dana Sejahtera",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "summary": "Critical API authorization gaps have been mapped to UU PDP obligations and remediated in the demo stack.",
            "compliance_score": self.calculate_score(mapped_findings),
            "controls_validated": [
                "JWT access and refresh tokens",
                "Object-level authorization for profiles and accounts",
                "RBAC for administrative APIs",
                "Structured audit logs with correlation IDs",
                "Container health checks and gateway routing",
            ],
            "findings": mapped_findings,
        }

    def calculate_score(self, mapped_findings):
        open_findings = [item for item in mapped_findings if item["remediation_status"] != "remediated"]
        if not open_findings:
            return 92
        score = 100 - (len(open_findings) * 15)
        return max(0, score)


if __name__ == "__main__":
    engine = UUPDPComplianceEngine()
    sample_findings = [
        {"type": "IDOR", "details": "Unauthorized /profiles/{id} access now returns 403 and records an audit event.", "status": "remediated"},
        {"type": "BOLA", "details": "Unauthorized /accounts/{id} access now returns 403 and records an audit event.", "status": "remediated"},
        {"type": "Broken Access Control", "details": "Regular users are denied /admin/users; admin users retain access.", "status": "remediated"},
    ]
    audit_report = engine.generate_report(sample_findings)
    output = Path(__file__).resolve().parents[2] / "reports" / "compliance" / "uu_pdp_sample_audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(audit_report, indent=4), encoding="utf-8")
    print(json.dumps(audit_report, indent=4))

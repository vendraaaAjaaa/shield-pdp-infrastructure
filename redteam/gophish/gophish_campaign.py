#!/usr/bin/env python3
"""Safe GoPhish awareness automation for the Shield-PDP lab.

This script creates and launches a GoPhish campaign only for synthetic lab
recipients through Mailpit/local SMTP, then writes SR-03 evidence JSON. It does
not collect credentials and does not permit internet email delivery.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error, parse, request


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPORT_PATH = REPO_ROOT / "reports" / "pentest" / "gophish_sr03_evidence.json"
DEFAULT_ALLOWED_RECIPIENT_DOMAINS = ("shield-pdp.local", "lab.local", "example.test")
LOCAL_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "::1",
    "gophish",
    "shield-pdp-gophish",
    "mailpit",
    "shield-pdp-mailpit",
    "host.docker.internal",
}


class SafetyError(RuntimeError):
    """Raised when an unsafe campaign boundary is requested."""


class GophishApiError(RuntimeError):
    """Raised when GoPhish API calls fail."""


@dataclass(frozen=True)
class LabRecipient:
    first_name: str
    last_name: str
    email: str
    position: str

    def as_gophish_target(self) -> dict[str, str]:
        return {
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "position": self.position,
        }


@dataclass(frozen=True)
class GophishConfig:
    api_url: str
    api_key: str
    public_url: str
    smtp_host: str
    report_path: Path
    timeout_seconds: float = 8.0
    verify_tls: bool = False
    poll_attempts: int = 5
    poll_interval_seconds: float = 2.0
    allowed_recipient_domains: tuple[str, ...] = DEFAULT_ALLOWED_RECIPIENT_DOMAINS


class GophishClient:
    def __init__(self, api_url: str, api_key: str, *, timeout_seconds: float = 8.0, verify_tls: bool = False):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.verify_tls = verify_tls

    def create_group(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._json_request("POST", "/api/groups/", payload)

    def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._json_request("POST", "/api/templates/", payload)

    def create_page(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._json_request("POST", "/api/pages/", payload)

    def create_smtp(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._json_request("POST", "/api/smtp/", payload)

    def create_campaign(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._json_request("POST", "/api/campaigns/", payload)

    def get_campaign_summary(self, campaign_id: int | str) -> dict[str, Any]:
        return self._json_request("GET", f"/api/campaigns/{campaign_id}/summary", None)

    def _json_request(self, method: str, path: str, payload: dict[str, Any] | None) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "api_key": self.api_key,
        }
        req = request.Request(f"{self.api_url}{path}", data=body, headers=headers, method=method)
        context = None
        if self.api_url.startswith("https://") and not self.verify_tls:
            context = ssl._create_unverified_context()
        try:
            with request.urlopen(req, timeout=self.timeout_seconds, context=context) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8")
            raise GophishApiError(f"{method} {path} failed with HTTP {exc.code}: {raw[:400]}") from exc
        except (OSError, TimeoutError) as exc:
            raise GophishApiError(f"{method} {path} failed: {exc}") from exc


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def local_hostname(value: str) -> str:
    host = value
    if "://" in value:
        parsed = parse.urlparse(value)
        host = parsed.hostname or ""
    elif ":" in value and not value.startswith("["):
        host = value.rsplit(":", 1)[0]
    return host.strip("[]").lower()


def is_local_host(value: str) -> bool:
    host = local_hostname(value)
    return host in LOCAL_HOSTNAMES or host.startswith("127.")


def validate_local_url(name: str, value: str) -> None:
    parsed = parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise SafetyError(f"{name} must be an http(s) URL")
    if not is_local_host(value):
        raise SafetyError(f"{name} must point to localhost or a lab container hostname")


def validate_smtp_host(smtp_host: str) -> None:
    if not is_local_host(smtp_host):
        raise SafetyError("smtp_host must be Mailpit/local SMTP; internet SMTP is not allowed")
    if ":" not in smtp_host:
        raise SafetyError("smtp_host must include a port, for example 127.0.0.1:1025")


def validate_recipients(
    recipients: list[LabRecipient],
    allowed_domains: tuple[str, ...] = DEFAULT_ALLOWED_RECIPIENT_DOMAINS,
) -> None:
    if not recipients:
        raise SafetyError("at least one lab recipient is required")
    normalized_domains = {domain.lower().lstrip("@") for domain in allowed_domains}
    for recipient in recipients:
        if "@" not in recipient.email:
            raise SafetyError(f"invalid recipient email: {recipient.email}")
        domain = recipient.email.rsplit("@", 1)[1].lower()
        if domain not in normalized_domains:
            raise SafetyError(f"recipient domain not allowed for lab campaign: {domain}")


def validate_safe_page(html: str) -> None:
    lowered = html.lower()
    blocked_fragments = (
        'type="password"',
        "type='password'",
        'name="password"',
        "name='password'",
        "capture password",
        "enter your password",
    )
    for fragment in blocked_fragments:
        if fragment in lowered:
            raise SafetyError("landing page must not request or capture credentials")


def build_safe_landing_page() -> str:
    html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Shield-PDP Awareness Simulation</title>
</head>
<body>
  <main>
    <h1>Security Awareness Simulation</h1>
    <p>This was a Shield-PDP awareness simulation inside the lab environment.</p>
    <p>No real credentials are requested, captured, or stored by this page.</p>
    <p>Review the message cues, report suspicious emails, and continue the exercise debrief.</p>
  </main>
</body>
</html>"""
    validate_safe_page(html)
    return html


def build_email_template() -> tuple[str, str]:
    subject = "Shield-PDP SR-03 awareness exercise"
    html = """<p>Hello {{.FirstName}},</p>
<p>This is a controlled Shield-PDP SR-03 awareness exercise for lab participants.</p>
<p>Please open the exercise awareness page: <a href="{{.URL}}">Awareness exercise page</a></p>
<p>This message is synthetic, delivered only to Mailpit/local SMTP, and does not request credentials.</p>"""
    return subject, html


def default_recipients() -> list[LabRecipient]:
    return [
        LabRecipient("Budi", "Customer", "budi.customer@shield-pdp.local", "Synthetic Customer"),
        LabRecipient("Maya", "Finance", "maya.finance@shield-pdp.local", "Finance Analyst"),
        LabRecipient("Siti", "SOC", "siti.soc@shield-pdp.local", "SOC Analyst"),
    ]


def parse_recipient(value: str) -> LabRecipient:
    parts = [part.strip() for part in value.split(",", 3)]
    if len(parts) != 4 or not all(parts):
        raise argparse.ArgumentTypeError("recipient must be First,Last,email,position")
    return LabRecipient(first_name=parts[0], last_name=parts[1], email=parts[2], position=parts[3])


def safe_campaign_suffix() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:8]


def normalize_stats(summary: dict[str, Any]) -> dict[str, int]:
    stats = summary.get("stats") if isinstance(summary.get("stats"), dict) else {}
    keys = ("sent", "opened", "clicked", "submitted_data")
    return {key: int(stats.get(key) or 0) for key in keys}


def sanitize_timeline(summary: dict[str, Any]) -> list[dict[str, Any]]:
    timeline = summary.get("timeline")
    if not isinstance(timeline, list):
        return []
    sanitized = []
    for item in timeline:
        if not isinstance(item, dict):
            continue
        event = {
            "email": item.get("email"),
            "message": item.get("message"),
        }
        timestamp = item.get("time") or item.get("timestamp")
        if timestamp:
            event["timestamp"] = timestamp
        sanitized.append({key: value for key, value in event.items() if value is not None})
    return sanitized


def validate_config(config: GophishConfig, recipients: list[LabRecipient]) -> None:
    validate_local_url("api_url", config.api_url)
    validate_local_url("public_url", config.public_url)
    validate_smtp_host(config.smtp_host)
    validate_recipients(recipients, config.allowed_recipient_domains)
    if not config.api_key:
        raise SafetyError("GoPhish API key is required")


def build_evidence(
    *,
    config: GophishConfig,
    recipients: list[LabRecipient],
    group: dict[str, Any],
    template: dict[str, Any],
    page: dict[str, Any],
    smtp: dict[str, Any],
    campaign: dict[str, Any],
    summary: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_version": "1.0",
        "control_id": "SR-03",
        "generated_at": utc_now(),
        "tool": {"name": "GoPhish", "mode": "safe-awareness-simulation"},
        "scope": {
            "environment": "Shield-PDP lab",
            "delivery": "Mailpit/local SMTP only",
            "targeting": "synthetic lab recipients only",
        },
        "campaign": {
            "id": campaign.get("id"),
            "name": campaign.get("name"),
            "status": summary.get("status") or campaign.get("status"),
        },
        "resources": {
            "group_id": group.get("id"),
            "template_id": template.get("id"),
            "landing_page_id": page.get("id"),
            "smtp_profile_id": smtp.get("id"),
            "smtp_host": config.smtp_host,
            "public_url": config.public_url,
        },
        "targets": [
            {
                "email": recipient.email,
                "domain": recipient.email.rsplit("@", 1)[1].lower(),
                "position": recipient.position,
            }
            for recipient in recipients
        ],
        "safety_controls": {
            "internet_delivery_allowed": False,
            "credential_capture_allowed": False,
            "raw_credential_storage_allowed": False,
            "smtp_boundary": "local_mailpit_only",
            "recipient_domain_allowlist": list(config.allowed_recipient_domains),
            "landing_page_mode": "awareness_only_no_form",
        },
        "summary": normalize_stats(summary),
        "events": sanitize_timeline(summary),
        "sr03_evidence": {
            "status": "collected",
            "description": "SR-03 phishing-awareness simulation evidence generated from a lab-only GoPhish campaign.",
            "limitations": "Evidence is educational and scoped to synthetic Shield-PDP lab recipients.",
        },
    }


def run_awareness_campaign(
    *,
    client: Any,
    config: GophishConfig,
    recipients: list[LabRecipient],
) -> dict[str, Any]:
    validate_config(config, recipients)
    suffix = safe_campaign_suffix()
    group_name = f"SR-03 Lab Recipients {suffix}"
    template_name = f"SR-03 Awareness Template {suffix}"
    page_name = f"SR-03 Awareness Landing Page {suffix}"
    smtp_name = f"SR-03 Mailpit SMTP {suffix}"
    campaign_name = f"SR-03 Awareness Simulation {suffix}"
    subject, template_html = build_email_template()
    landing_page = build_safe_landing_page()

    group = client.create_group({"name": group_name, "targets": [recipient.as_gophish_target() for recipient in recipients]})
    template = client.create_template({"name": template_name, "subject": subject, "html": template_html})
    page = client.create_page(
        {
            "name": page_name,
            "html": landing_page,
            "capture_credentials": False,
            "capture_passwords": False,
        }
    )
    smtp = client.create_smtp(
        {
            "name": smtp_name,
            "host": config.smtp_host,
            "from_address": "security-awareness@shield-pdp.local",
            "ignore_cert_errors": True,
        }
    )
    campaign = client.create_campaign(
        {
            "name": campaign_name,
            "template": {"name": template_name},
            "page": {"name": page_name},
            "smtp": {"name": smtp_name},
            "url": config.public_url,
            "groups": [{"name": group_name}],
            "launch_date": utc_now(),
        }
    )
    campaign_id = campaign.get("id")
    if campaign_id is None:
        raise GophishApiError("GoPhish campaign response did not include an id")

    summary = {}
    attempts = max(1, config.poll_attempts)
    for attempt in range(attempts):
        summary = client.get_campaign_summary(campaign_id)
        if summary.get("status") in {"Completed", "Queued", "In progress"}:
            break
        if attempt < attempts - 1 and config.poll_interval_seconds > 0:
            time.sleep(config.poll_interval_seconds)

    evidence = build_evidence(
        config=config,
        recipients=recipients,
        group=group,
        template=template,
        page=page,
        smtp=smtp,
        campaign=campaign,
        summary=summary,
    )
    config.report_path.parent.mkdir(parents=True, exist_ok=True)
    config.report_path.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return evidence


def env_tuple(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv(name)
    if not raw:
        return default
    return tuple(item.strip().lower().lstrip("@") for item in raw.split(",") if item.strip())


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Launch a safe Shield-PDP SR-03 GoPhish awareness campaign.")
    parser.add_argument("--api-url", default=os.getenv("GOPHISH_API_URL", "https://127.0.0.1:3333"))
    parser.add_argument("--api-key", default=os.getenv("GOPHISH_API_KEY", ""))
    parser.add_argument("--public-url", default=os.getenv("GOPHISH_PUBLIC_URL", "http://127.0.0.1:8080"))
    parser.add_argument("--smtp-host", default=os.getenv("GOPHISH_SMTP_HOST", "127.0.0.1:1025"))
    parser.add_argument("--report-path", type=Path, default=Path(os.getenv("GOPHISH_REPORT_PATH", str(DEFAULT_REPORT_PATH))))
    parser.add_argument("--timeout", type=float, default=float(os.getenv("GOPHISH_TIMEOUT", "8")))
    parser.add_argument("--poll-attempts", type=int, default=int(os.getenv("GOPHISH_POLL_ATTEMPTS", "5")))
    parser.add_argument("--poll-interval", type=float, default=float(os.getenv("GOPHISH_POLL_INTERVAL_SECONDS", "2")))
    parser.add_argument("--verify-tls", action="store_true", default=os.getenv("GOPHISH_VERIFY_TLS", "false").lower() == "true")
    parser.add_argument(
        "--recipient",
        action="append",
        type=parse_recipient,
        default=[],
        help="Lab recipient as First,Last,email,position. May be repeated.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    recipients = args.recipient or default_recipients()
    config = GophishConfig(
        api_url=args.api_url,
        api_key=args.api_key,
        public_url=args.public_url,
        smtp_host=args.smtp_host,
        report_path=args.report_path,
        timeout_seconds=args.timeout,
        verify_tls=args.verify_tls,
        poll_attempts=args.poll_attempts,
        poll_interval_seconds=args.poll_interval,
        allowed_recipient_domains=env_tuple("GOPHISH_ALLOWED_RECIPIENT_DOMAINS", DEFAULT_ALLOWED_RECIPIENT_DOMAINS),
    )
    try:
        client = GophishClient(
            config.api_url,
            config.api_key,
            timeout_seconds=config.timeout_seconds,
            verify_tls=config.verify_tls,
        )
        evidence = run_awareness_campaign(client=client, config=config, recipients=recipients)
    except (SafetyError, GophishApiError, argparse.ArgumentTypeError) as exc:
        print(f"gophish automation failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps({"control_id": evidence["control_id"], "campaign": evidence["campaign"], "report_path": str(config.report_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

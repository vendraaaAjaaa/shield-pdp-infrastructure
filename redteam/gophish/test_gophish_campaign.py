import json
import tempfile
import unittest
from pathlib import Path


class FakeGophishClient:
    def __init__(self):
        self.calls = []

    def create_group(self, payload):
        self.calls.append(("groups", payload))
        return {"id": 11, "name": payload["name"]}

    def create_template(self, payload):
        self.calls.append(("templates", payload))
        return {"id": 22, "name": payload["name"]}

    def create_page(self, payload):
        self.calls.append(("pages", payload))
        return {"id": 33, "name": payload["name"]}

    def create_smtp(self, payload):
        self.calls.append(("smtp", payload))
        return {"id": 44, "name": payload["name"], "host": payload["host"]}

    def create_campaign(self, payload):
        self.calls.append(("campaigns", payload))
        return {"id": 55, "name": payload["name"], "status": "In progress"}

    def get_campaign_summary(self, campaign_id):
        self.calls.append(("campaigns_summary", campaign_id))
        return {
            "id": campaign_id,
            "name": "SR-03 Awareness Simulation",
            "status": "Completed",
            "stats": {"sent": 2, "opened": 1, "clicked": 1, "submitted_data": 0},
            "timeline": [
                {"email": "reza.red@shield-pdp.local", "message": "Email Sent"},
                {"email": "reza.red@shield-pdp.local", "message": "Clicked Link"},
                {
                    "email": "siti.soc@shield-pdp.local",
                    "message": "Submitted Data",
                    "details": {"payload": {"password": "should-not-survive"}},
                },
            ],
        }


class GophishCampaignTest(unittest.TestCase):
    def test_rejects_internet_recipient_domains(self):
        from redteam.gophish.gophish_campaign import LabRecipient, SafetyError, validate_recipients

        with self.assertRaises(SafetyError):
            validate_recipients([LabRecipient("Mallory", "External", "mallory@gmail.com", "contractor")])

    def test_rejects_non_local_smtp_hosts(self):
        from redteam.gophish.gophish_campaign import SafetyError, validate_smtp_host

        with self.assertRaises(SafetyError):
            validate_smtp_host("smtp.gmail.com:587")

    def test_safe_landing_page_has_no_password_capture(self):
        from redteam.gophish.gophish_campaign import build_safe_landing_page

        page = build_safe_landing_page()

        self.assertNotIn("type=\"password\"", page.lower())
        self.assertNotIn("name=\"password\"", page.lower())
        self.assertIn("awareness simulation", page.lower())

    def test_launch_writes_sr03_evidence_without_raw_credentials(self):
        from redteam.gophish.gophish_campaign import (
            GophishConfig,
            LabRecipient,
            run_awareness_campaign,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            report_path = Path(tmpdir) / "gophish_sr03_evidence.json"
            report = run_awareness_campaign(
                client=FakeGophishClient(),
                config=GophishConfig(
                    api_url="https://127.0.0.1:3333",
                    api_key="unit-test-key",
                    public_url="http://127.0.0.1:8080",
                    smtp_host="127.0.0.1:1025",
                    report_path=report_path,
                    poll_attempts=1,
                    poll_interval_seconds=0,
                ),
                recipients=[
                    LabRecipient("Reza", "Red", "reza.red@shield-pdp.local", "Red Team Operator"),
                    LabRecipient("Siti", "SOC", "siti.soc@shield-pdp.local", "SOC Analyst"),
                ],
            )

            persisted = json.loads(report_path.read_text(encoding="utf-8"))
            rendered = json.dumps(persisted, sort_keys=True)

        self.assertEqual(report["control_id"], "SR-03")
        self.assertEqual(report["safety_controls"]["internet_delivery_allowed"], False)
        self.assertEqual(report["safety_controls"]["credential_capture_allowed"], False)
        self.assertEqual(report["campaign"]["id"], 55)
        self.assertEqual(report["summary"]["submitted_data"], 0)
        self.assertNotIn("should-not-survive", rendered)
        self.assertNotIn("password", rendered.lower())


if __name__ == "__main__":
    unittest.main()

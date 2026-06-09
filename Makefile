.PHONY: help init-env remote-db-env build up local-up down restart logs ps smoke redteam-sim compliance-report validate web-dev-lan web-dev-lan-check web-dev-lan-restart web-build-lan stage2-up stage2-ps stage2-validate stage3-up stage3-ps stage3-validate stage4-up stage4-ps stage4-validate stage5-up stage5-ps stage5-validate stage6-up stage6-ps stage6-validate stage7-up stage7-ps stage7-validate

REMOTE_DB_ENV ?= /opt/shield/secrets/database.env
WEB_HOST ?= 192.168.18.205
WEB_PORT ?= 3200
WEB_API_BASE_URL ?= http://$(WEB_HOST):3000
WEB_URL ?= http://$(WEB_HOST):$(WEB_PORT)

help:
	@echo "Shield-PDP: hardened cybersecurity demo stack"
	@echo "------------------------------------------------"
	@echo "init-env           - Create a local .env with generated demo secrets"
	@echo "remote-db-env      - Create/sync remote PostgreSQL secret outside the repo"
	@echo "up                 - Build and start the infrastructure using shield-db PostgreSQL"
	@echo "local-up           - Build and start with the dev-only local PostgreSQL profile"
	@echo "down               - Stop the infrastructure"
	@echo "restart            - Recreate the running stack"
	@echo "build              - Build containers"
	@echo "logs               - Follow service logs"
	@echo "ps                 - Show service status"
	@echo "smoke              - Run API/auth/gateway smoke checks"
	@echo "redteam-sim        - Validate blocked IDOR/BOLA/admin probes"
	@echo "compliance-report  - Generate UU PDP compliance evidence"
	@echo "validate           - Run all demo validation checks"
	@echo "web-dev-lan        - Run Next.js frontend for direct Kali LAN access"
	@echo "web-dev-lan-check  - Check whether the LAN frontend port is already listening"
	@echo "web-dev-lan-restart - Stop the LAN frontend listener on port $(WEB_PORT) and restart"
	@echo "web-build-lan      - Build Next.js frontend with the LAN API base URL"
	@echo "stage2-up          - Start Stage 2 enterprise core overlay"
	@echo "stage2-ps          - Show Stage 2 enterprise overlay status"
	@echo "stage2-validate    - Validate Stage 2 gateway, identity, portals, logs, observability"
	@echo "stage3-up          - Start Stage 3 vulnerable enterprise ecosystem overlay"
	@echo "stage3-ps          - Show Stage 3 enterprise overlay status"
	@echo "stage3-validate    - Validate Stage 3 identity, trust, CI/CD, recon, secrets paths"
	@echo "stage4-up          - Start Stage 4 detection, telemetry, and purple-team overlay"
	@echo "stage4-ps          - Show Stage 4 enterprise overlay status"
	@echo "stage4-validate    - Validate Stage 4 SIEM, detection, correlation, SOC workflows"
	@echo "stage5-up          - Start Stage 5 adversary operations simulation overlay"
	@echo "stage5-ps          - Show Stage 5 enterprise overlay status"
	@echo "stage5-validate    - Validate Stage 5 controlled adversary simulation workflows"
	@echo "stage6-up          - Start Stage 6 enterprise intelligence and digital twin overlay"
	@echo "stage6-ps          - Show Stage 6 enterprise overlay status"
	@echo "stage6-validate    - Validate Stage 6 intelligence, graph, hunt, coverage, and replay workflows"
	@echo "stage7-up          - Start Stage 7 productionization and enterprise-scale overlay"
	@echo "stage7-ps          - Show Stage 7 enterprise overlay status"
	@echo "stage7-validate    - Validate Stage 7 Kubernetes, GitOps, telemetry, resilience, governance, and replay workflows"

init-env:
	@python3 -c 'from pathlib import Path; import secrets; p=Path(".env"); print(".env already exists") if p.exists() else (p.write_text("APP_ENV=demo\nSECRET_KEY=" + secrets.token_urlsafe(48) + "\nJWT_ISSUER=shield-pdp\nCORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3200,http://127.0.0.1:3200,http://192.168.18.205:3200,http://localhost:8000\nLOG_LEVEL=INFO\nRESET_DEMO_PASSWORDS=false\nENABLE_VULNERABLE_DEMO=true\nNEXT_PUBLIC_SHIELD_API_BASE_URL=http://localhost:3000\nSHIELD_API_BASE_URL=http://localhost:3000\n", encoding="utf-8"), print("Created .env without database secrets"))'

remote-db-env:
	bash infrastructure/database/create-database-and-user.sh

up: init-env remote-db-env
	set -a; . $(REMOTE_DB_ENV); set +a; docker compose up -d --build

local-up: init-env
	LOCAL_DB_USER=$${LOCAL_DB_USER:-shield} LOCAL_DB_PASSWORD=$${LOCAL_DB_PASSWORD:-local-db-change-me} LOCAL_DB_NAME=$${LOCAL_DB_NAME:-shield_pdp_db} DB_HOST=db docker compose --profile local-db up -d --build

down:
	docker compose down

restart: down up

build: init-env remote-db-env
	set -a; . $(REMOTE_DB_ENV); set +a; docker compose build

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

smoke:
	python3 scripts/automation/smoke_test.py

redteam-sim:
	python3 redteam/simulations/api_exploit.py

compliance-report:
	python3 compliance/engine/uu_pdp_mapper.py

validate: smoke redteam-sim compliance-report

web-dev-lan:
	@if ss -ltn "( sport = :$(WEB_PORT) )" | grep -q LISTEN; then \
		echo "Frontend already appears to be running at $(WEB_URL)"; \
		echo "Use 'make web-dev-lan-check' to inspect the listener or 'make web-dev-lan-restart' to restart it."; \
	else \
		cd apps/web && NEXT_PUBLIC_SHIELD_API_BASE_URL=$(WEB_API_BASE_URL) npm run dev; \
	fi

web-dev-lan-check:
	@if ss -ltn "( sport = :$(WEB_PORT) )" | grep -q LISTEN; then \
		echo "Frontend already appears to be running at $(WEB_URL)"; \
		ss -ltnp "( sport = :$(WEB_PORT) )"; \
	else \
		echo "No frontend listener found on $(WEB_URL)"; \
	fi

web-dev-lan-restart:
	@pids="$$(ss -ltnp "( sport = :$(WEB_PORT) )" | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u)"; \
	if [ -n "$$pids" ]; then \
		for pid in $$pids; do \
			cmd="$$(ps -p $$pid -o command=)"; \
			case "$$cmd" in \
				*next-server*|*next\ dev*) ;; \
				*) echo "Port $(WEB_PORT) is used by a non-Next process ($$pid: $$cmd). Stop it manually or choose another WEB_PORT."; exit 1 ;; \
			esac; \
		done; \
		echo "Stopping process listening on $(WEB_URL): $$pids"; \
		kill $$pids; \
		sleep 2; \
	fi; \
	cd apps/web && NEXT_PUBLIC_SHIELD_API_BASE_URL=$(WEB_API_BASE_URL) npm run dev

web-build-lan:
	cd apps/web && NEXT_PUBLIC_SHIELD_API_BASE_URL=$(WEB_API_BASE_URL) npm run build

stage2-up: init-env
	docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage2-core up -d --build --wait

stage2-ps:
	docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage2-core ps

stage2-validate:
	python3 scripts/automation/stage2_validate.py


stage3-up: init-env
	STAGE3_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage3-core up -d --build --wait
	STAGE3_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage3-core up -d --force-recreate --no-deps --wait enterprise-gateway

stage3-ps:
	docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage3-core ps

stage3-validate:
	python3 scripts/automation/stage3_validate.py

stage4-up: init-env
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage4-core up -d --build --wait
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage4-core up -d --force-recreate --no-deps --wait enterprise-gateway

stage4-ps:
	docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage4-core ps

stage4-validate:
	python3 scripts/automation/stage4_validate.py

stage5-up: init-env
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true STAGE5_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage5-core up -d --build --wait
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true STAGE5_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage5-core up -d --force-recreate --no-deps --wait enterprise-gateway

stage5-ps:
	docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage5-core ps

stage5-validate:
	python3 scripts/automation/stage5_validate.py

stage6-up: init-env
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true STAGE5_TARGETS_ENABLED=true STAGE6_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage6-core up -d --build --wait
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true STAGE5_TARGETS_ENABLED=true STAGE6_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage6-core up -d --force-recreate --no-deps --wait enterprise-gateway

stage6-ps:
	docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage6-core ps

stage6-validate:
	python3 scripts/automation/stage6_validate.py

stage7-up: init-env
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true STAGE5_TARGETS_ENABLED=true STAGE6_TARGETS_ENABLED=true STAGE7_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage7-core up -d --build --wait
	STAGE3_TARGETS_ENABLED=true STAGE4_TARGETS_ENABLED=true STAGE5_TARGETS_ENABLED=true STAGE6_TARGETS_ENABLED=true STAGE7_TARGETS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage7-core up -d --force-recreate --no-deps --wait enterprise-gateway

stage7-ps:
	docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage7-core ps

stage7-validate:
	python3 scripts/automation/stage7_validate.py

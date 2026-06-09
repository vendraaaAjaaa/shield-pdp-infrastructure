# GitHub Publish Checklist

Use this checklist before initializing git or pushing Shield-PDP Infrastructure to GitHub.

## Required Secret Safety Actions

- [ ] Rotate the GoPhish API key used during local testing/chat exposure before any public push.
- [ ] Verify `.env` is ignored and not staged.
- [ ] Verify `apps/web/.env.local` is ignored and not staged.
- [ ] Verify no `database.env` file is inside the repository tree.
- [ ] Verify no PostgreSQL dumps, backups, SQLite databases, or raw `.sql` exports are staged.
- [ ] Verify no JWT secret, API key, access token, refresh token, private key, or real credential is staged.
- [ ] Never commit real credentials. Use `.env.example` and `apps/web/.env.local.example` only.

## Safe Scans

Run filename-based checks first. These commands list file paths only.

```bash
find . -path './.git' -prune -o -path './node_modules' -prune -o -path './apps/web/node_modules' -prune -o \( -name '.env' -o -name '.env.local' -o -name 'database.env' -o -name '*.pem' -o -name '*.key' -o -name '*.dump' -o -name '*.p12' -o -name '*.pfx' -o -name 'id_rsa' -o -name 'id_ed25519' \) -print
```

Run a marker scan without printing secret values.

```bash
rg -l -i --hidden --no-ignore --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/__pycache__/**' --glob '!**/.pytest_cache/**' 'GOPHISH_API_KEY|DATABASE_URL|POSTGRES_PASSWORD|JWT_SECRET|PRIVATE_KEY|access_token|refresh_token|/opt/shield/secrets|DB_PASSWORD|DATABASE_PASSWORD|database password'
```

If installed, run at least one dedicated scanner before publishing.

```bash
gitleaks detect --no-git --source .
git secrets --scan
trufflehog filesystem .
```

## GitHub Import Steps

- [ ] Initialize git only after the scans are reviewed.
- [ ] Stage only safe publish-preparation files first: `README.md`, `.gitignore`, `.env.example`, `apps/web/.env.local.example`, and `docs/GITHUB_PUBLISH_CHECKLIST.md`.
- [ ] Re-check staged files with `git diff --cached --name-only`.
- [ ] Commit the safe metadata/docs files.
- [ ] Add the GitHub remote URL.
- [ ] Push the selected branch.
- [ ] Set the repository description:

```bash
gh repo edit --description "Compliance-driven fintech penetration testing and UU PDP data privacy audit lab with API BOLA/IDOR, hybrid-cloud segmentation, audit evidence, and Shield-PDP reporting."
```

Do not change repository visibility unless explicitly approved.

## Reports And Evidence

- [ ] Review report JSON files before staging; runtime evidence may contain tokens, IDs, internal hostnames, or lab-only artifacts.
- [ ] Do not ignore all `reports/` blindly; decide intentionally which sanitized deliverables belong in GitHub.
- [ ] Keep raw local evidence out of the initial import unless it has been manually reviewed.

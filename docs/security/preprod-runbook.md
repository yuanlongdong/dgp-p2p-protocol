# Pre-Production Runbook

1. Copy .env.production.example to .env.
2. Fill values from production-params-register.md.
3. Ensure secrets are from vault and GitHub Actions Secrets.
4. Update production-secrets-matrix.md.
5. Run: pnpm --filter @dgp/contracts run preflight:production.
6. Ensure production-preflight.json has "ok": true.

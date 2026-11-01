---
name: ContractTestCI
description: "Maintain GitHub Actions, Azure or local Pact automation with fresh consumers, separate Swagger gate, scoped provider verification and artifacts."
argument-hint: "Target: github-actions, azure or local-script; service scope and start method"
---

# ContractTestCI

Use to add/fix contract pipelines, not generate contracts. Inspect existing `.github/workflows/contract-tests.yml`, `swagger-gap-agent.yml`, `azure-pipelines.yml`, `package.json` and `scripts/run-contract-ci.ts` before patching. Extend existing automation; do not invent scripts or duplicate runners.

## Required flow
1. Checkout; use Node satisfying `package.json.engines` (current CI 22.x, minimum 22.18.0 on that line); `npm ci`. Prefer npm cache keyed by lockfile, never cached pacts as regeneration.
2. Resolve gateway via `node scripts/resolve-gateway-url.js` (`--ado` for Azure). User override uses `GATEWAY_BASE_URL_OVERRIDE`; otherwise config wins. `URL_CLM` etc. select explicit service targets. Local ports require `PACT_USE_LOCAL_PORTS=1`: gateway 4100, CLM–DOC 4101–4106.
3. Ensure gateway `/api/health` and scoped service proxy health with bounded retries. Start `../ContratTestingBussinessDemo` only if requested/available; wait for readiness and retain startup errors.
4. Clear old `pacts/*.json` through the existing full consumer runner: `npm run test:contract:consumer-only -- --full-consumer`. Preserve full consumer suite even when provider scope is narrow.
5. Run separate `npm run test:swagger-coverage:ci` against this gateway's `/openapi.json`; capture its exit even if continuing to diagnostics/provider. `test:contract` alone does NOT execute this gate.
6. `npm run test:contract:provider-only -- --services=CLM,MDM`, substituting `PACT_SERVICES` (default CLM,MDM). Explicit `all` means all seven configured providers; do not silently broaden/narrow scope. Missing pacts/skipped providers are not successful verification.
7. Preserve consumer results across jobs; upload `pacts/` and `reports/` even on failure when present, including coverage JSON and full verifier logs. Refresh existing reports using supported scripts where needed. Missing/error evidence is not zero gaps.
8. Gate on consumer, coverage and provider failures. Continuing for artifacts/email must not mask final failure. Explain coverage disabled/continueOnError behavior in existing pipelines.

## Integration rules
- Document service setup, environment, local commands, gate conditions and artifact names. No `.env`, tokens or SMTP credentials in artifacts/output.
- Existing GHA gap automation: `swagger-gap-agent.yml` + `npm run agent:swagger-gaps`; inspect dispatch/permissions/secrets before describing or changing it. It authors fixes, unlike verify-only auditors.
- Broker integration is optional and aspirational until scripts/auth exist; coordinate `PactBrokerPublisher`, never add a mandatory gate without user intent.
- Never run providers before fresh consumers, commit ignored pacts, or add Playwright E2E to this contract gate.

## Report
Files changed; local reproduction; scope and gate behavior; artifacts; commands/results and untested constraints. Dry-run if services exist. No remote pipeline trigger, publish, or git push without authorization.

---
name: ContractTestCI
description: >-
  Wire CI or local automation for TaxMesh Pact tests: ensure services healthy,
  run consumer then provider, upload pact artifacts, fail on mismatches. Use when
  adding GitHub Actions or a contract-test pipeline.
argument-hint: >-
  Target (github-actions|local-script) and optional TaxMesh start method
  (npm start in ../ContratTestingBussinessDemo or pre-running services)
---

# Contract Test CI

You set up **automation** so Pact consumer + provider verification runs reliably
in CI or via a local one-shot script. You do not replace the Swagger generator.

## When to activate

- “add CI for pact”, “pipeline for contract tests”
- “script that starts TaxMesh and runs test:contract”
- Failing CI job that should gate on provider mismatches

## Hard rules

### R1 — Pipeline shape (required order)

```text
1. Checkout + Node 18+
2. npm ci (this repo)
3. Ensure TaxMesh APIs healthy (start sibling demo or use running URLs)
4. npm run test:consumer
5. npm run test:swagger-coverage:ci   # OpenAPI ↔ Pact gap gate (live /openapi.json)
6. npm run test:provider   # all seven providers
7. Upload pacts/ + reports/swagger-coverage.json as artifacts
8. Fail the job if any provider verify fails OR swagger gaps (missing ops)
```

Equivalent local: `npm run test:contract` when services are already up.  
Swagger-only: `npm run test:swagger-coverage` (warn) or `:ci` (fail-on-gap).

### R2 — Service health
- Default ports: Gateway `4100`, CLM `4101` … DOC `4106`.
- Before provider step, probe at least `GET http://127.0.0.1:4100/api/health` (or configured `GATEWAY_BASE_URL`).
- If starting sibling repo: `../ContratTestingBussinessDemo` → `npm install` + `npm start` (background), wait for health.
- Env: `URL_CLM`, `URL_MDM`, … `GATEWAY_BASE_URL` for non-local.

### R3 — Artifacts
- Upload `pacts/*.json` on every run (even on failure, if present).
- Optional: Jest / verifier stdout logs.
- Do not upload secrets or `.env`.

### R4 — Caching
- Cache `node_modules` (or npm cache) keyed by `package-lock.json`.
- Do not cache `pacts/` as a substitute for regenerating from consumer tests.

### R5 — Broker (optional later)
- If `PACT_BROKER_BASE_URL` is set, after consumer success hand off publish steps to rules in `PactBrokerPublisher`.
- Never fail closed on missing broker unless user requires publish.

### R6 — GitHub Actions conventions
- Prefer workflow under `.github/workflows/contract-tests.yml` (create when implementing).
- Use `npm run test:provider` (not a subset) for main branch gates unless user scopes otherwise.
- Document required services in the workflow comments / README.

### R7 — Report
1. What file(s) added/changed (workflow or script)  
2. How to run locally  
3. What fails the gate  
4. Artifact names  

## Workflow

```text
1. Confirm user wants GHA vs local script
2. Add workflow/script with health wait + test:contract
3. Ensure package.json scripts already exist (do not duplicate logic)
4. Document in README briefly
5. Dry-run locally if services available
```

## Anti-patterns

- Do not run provider before consumer (stale/missing pacts)  
- Do not mark provider failures as warnings  
- Do not start Playwright E2E inside this contract pipeline  
- Do not commit `pacts/` if `.gitignore` excludes them — use CI artifacts instead  

## Repo pointers

- Scripts: `package.json` → `test:consumer`, `test:provider`, `test:contract`
- Provider runner: `tests/provider/run-all.ts`
- Agents: `PactProviderVerifier`, `PactBrokerPublisher`, `ContractCoverageAuditor`
- Sibling app: `../ContratTestingBussinessDemo`

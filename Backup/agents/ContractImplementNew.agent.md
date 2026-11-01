---
name: ContractImplementNew
description: >-
  EXECUTE: implement durable Pact consumer tests for DiffAuditor missing/new
  OpenAPI ops (e.g. GET /api/proxy/CLM/v2/status). Must drop swagger-coverage
  missing to 0 for those ops. Mismatch/update → ContractImplementUpdated.
argument-hint: >-
  missingOperations from reports/swagger-contract-diff.json, or “implement
  missing/new from last DiffAuditor”
---

# Contract Implement — New / missing APIs only

You **implement** (not just document) durable Pact **consumer** tests + provider
states for every DiffAuditor **missing/new** op until
`npm run test:swagger-coverage` no longer lists them.

**Success for this agent:** `missingOperations` / coverage **missing** count for
scoped ops goes to **0**. Provider BodyMismatch (`legalName`) is **out of
scope** → `ContractImplementUpdated`.

## Current golden backlog (implement these)

From [`reports/swagger-contract-diff.json`](../../reports/swagger-contract-diff.json)
`missingOperations[]` / CI Gaps banner consumer side:

| Method | Path | Op id | How to implement |
|--------|------|-------|------------------|
| GET | `/api/proxy/CLM/v2/status` | `clm_v2_status` | Live sample → `testdata/clm/v2-status.json` → `tests/consumer/gateway.v2-validation.consumer.spec.ts` with **literal** `.withRequest('GET', '/api/proxy/CLM/v2/status', …)` via `createGatewayPact()` → state `CLM v2 status is available` in `tests/provider/states.ts` |

Coverage only counts durable evidence from consumer **source**
(`withRequest('METHOD', '/literal/path')`) or catalog — a gitignored
pact-only orphan **does not** clear missing. The path string in
`withRequest` **must** be the Swagger path (`/api/proxy/CLM/v2/status`), not
only `/v2/status`.

## When to activate

- User says implement / fix / execute **ContractImplementNew** or “cover missing”
- DiffAuditor: `Consumer swagger gaps: N` / `Missing OpenAPI ops: N` with N ≥ 1
- After DiffAuditor — **do the work**, do not stop at a plan

## Default host

| Surface | URL |
|---------|-----|
| Gateway | `gateway.config.json` → notifications tunnel |
| OpenAPI | `{gateway}/openapi.json` |
| Live probe | `{gateway}/api/proxy/CLM/v2/status` → must be **200** JSON |

Skip ops that **502** on the chosen host (e.g. some MDM `/v2/*`) unless user insists.

## Hard rules

### R1 — Scope = missing/new only
1. Load `missingOperations[]` from DiffAuditor report (or user list).
2. Skip covered / mismatch-only rows (→ Updated).
3. Implement **every** missing row in scope before reporting done.

### R2 — Live sample → testdata → matchers
1. `GET` live URL; abort op if status ≥ 500.
2. Save example JSON under `testdata/**`.
3. Wire through `src/testdata/index.ts` when used by the spec.
4. MatchersV3 `like` / `string` / `integer` / `boolean` / `eachLike` from **live** shape.

### R3 — Durable consumer (coverage gate)
```ts
.withRequest('GET', '/api/proxy/CLM/v2/status', (b) => {
  b.headers({ Accept: 'application/json' });
})
```
- Provider: `TaxMesh-Gateway` via `createGatewayPact()` for `/api/proxy/…` paths  
- Register `.given('CLM v2 status is available')` in `tests/provider/states.ts`  
- Prefer new file `tests/consumer/gateway.v2-validation.consumer.spec.ts`

### R4 — CT `/consume/{id}` (if ever in missing list)
Provider = `ct.consumer` only — never producer. See catalog.

### R5 — Verify (mandatory before “done”)
```bash
npx jest --runInBand --testPathPatterns=gateway.v2-validation.consumer.spec.ts
npm run test:provider:gateway   # interaction for CLM/v2/status should OK (other v2 502 may still fail — note them)
npm run test:swagger-coverage   # GET /api/proxy/CLM/v2/status must NOT appear under Missing
```

### R6 — Report
1. Host used  
2. Ops implemented → files  
3. Coverage missing before → after  
4. Skipped (502)  
5. Remaining missing (must be empty for scoped backlog)

## Workflow

```text
1. Read missingOperations[] from swagger-contract-diff.json
2. Live GET each path — confirm 200
3. Add testdata + consumer spec + state handler
4. Run consumer test → swagger-coverage (missing drops)
5. Provider gateway for new interaction (document unrelated 502s)
6. Short report — do not leave missing unimplemented
```

## Anti-patterns

- Describing the backlog without writing the consumer file  
- Pact-only / hand-edited `pacts/` without durable `withRequest` in `tests/consumer`  
- Using path `/v2/status` alone when Swagger key is `/api/proxy/CLM/v2/status`  
- Fixing `legalName` here (→ `ContractImplementUpdated`)  
- Claiming done while coverage still lists the op as missing  

## Repo pointers

- Diff: `SwaggerContractDiffAuditor.agent.md`, `reports/swagger-contract-diff.json`
- Updated: `ContractImplementUpdated.agent.md`
- Patterns: `PactConsumerAuthor.agent.md`, `gateway.contracts-by-id.consumer.spec.ts`

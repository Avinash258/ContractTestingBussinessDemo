---
name: PactProviderVerifier
description: >-
  Run and fix TaxMesh Pact provider verification for one service or all seven
  (CLM, MDM, ACC, TAX, ALC, DOC, Gateway). Use when verifying providers, fixing
  provider failures, or running test:provider scripts.
argument-hint: >-
  Provider to verify (clm|mdm|acc|tax|alc|doc|gateway|all) and optional base URL
  overrides (URL_CLM, GATEWAY_BASE_URL, …)
---

# Pact Provider Verifier

You run **provider verification** against live TaxMesh services and fix the
smallest set of state handlers / matchers so verification passes.

## When to activate

- “verify MDM”, “provider failing”, `npm run test:provider:tax`
- After consumer tests wrote new `pacts/*.json`
- CI-style “are providers still honoring contracts?”

## Hard rules

### R1 — Prerequisites
- TaxMesh stack must be up (`../ContratTestingBussinessDemo` → `npm start`), or the target service port.
- Ports: CLM `4101`, MDM `4102`, ACC `4103`, TAX `4104`, ALC `4105`, DOC `4106`, Gateway `4100`.
- Env overrides: `URL_CLM`, `URL_MDM`, … `GATEWAY_BASE_URL` / `TAXMESH_BASE_URL`.
- Pacts must exist: if none, run `npm run test:consumer` first (or hand off to consumer author).

### R2 — Scripts (use these, don’t invent)

| Scope | Command |
|-------|---------|
| All | `npm run test:provider` → `tests/provider/run-all.ts` |
| One | `npm run test:provider:clm\|mdm\|acc\|tax\|alc\|doc\|gateway` |
| Filter pacts | `src/pact/listPacts.ts` by `provider.name` |

### R3 — State handlers
- Every consumer `.given(...)` string must exist in [`tests/provider/states.ts`](../../tests/provider/states.ts).
- Gateway filing mutations that need engagement data: seed with `POST /api/filing/run-all` in the state handler (see [`tests/provider/gateway.provider.verify.ts`](../../tests/provider/gateway.provider.verify.ts)).
- Reset / upload-400: no seed required.

### R4 — Fix against live bodies
- On mismatch, `GET`/`POST` the live path and compare to the pact matcher.
- Prefer fixing matchers/fixtures to match intentional API shape; if the API is wrong, say so — do not silently weaken contracts.
- Never skip provider verify or use `--passWithNoTests` style cheats.

### R5 — Common live quirks (TaxMesh)
- `producedAt`: full-string ISO regex `/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/`
- CT-09 field: live/catalog key is `bttAsks` (see `src/catalog/payloads.ts`)
- `GET /flow` → `service` is a **string** id (e.g. `"CLM"`), not `{ id: "CLM" }`
- Avoid `consumed: like([])` when the service has non-empty consumed lists

### R6 — Report
1. Which provider(s) ran  
2. Pass/fail per provider  
3. Files changed (if any)  
4. Re-run command that proves green  

## Workflow

```text
1. Confirm ports / env
2. Ensure pacts exist (consumer run if needed)
3. npm run test:provider:<svc> or test:provider
4. On failure → live fetch failing path → fix matcher/state
5. Re-run failing provider only, then full run-all if multiple changed
```

## Anti-patterns

- Do not rewrite all consumer tests to “make provider pass”  
- Do not delete interactions from pact JSON by hand  
- Do not invent broker publish here (use `PactBrokerPublisher`)  

## Repo pointers

- Verifiers: `tests/provider/*.provider.verify.ts`
- Shared verify helper: `tests/provider/verify-provider.ts`
- States: `tests/provider/states.ts`
- Failure deep-dive: hand off to `PactFailureDoctor`

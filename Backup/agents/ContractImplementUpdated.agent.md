---
name: ContractImplementUpdated
description: >-
  Fix ONLY DiffAuditor providerFailures / mismatch-update rows (e.g. MDM
  CT-01 + downstream/ACC legalName→entityName) in committed matchers/testdata.
  Not for missing/new APIs (ContractImplementNew).
argument-hint: >-
  reports/swagger-contract-diff.json providerFailures[], or paste provider
  Gaps table from DiffAuditor / CI FAIL email
---

# Contract Implement — Mismatch / provider-update only

You **update existing** contracts so they match **live** API for rows in
DiffAuditor **Gaps — failed on provider** / `providerFailures[]`.

**Current golden backlog** (notifications host, Gaps 3 audit):

| Path | Interaction | Fix |
|------|-------------|-----|
| `GET /contracts/ct-01/entities` | an ACC request for CT-01 entities | `legalName` → `entityName` |
| `GET /downstream/ACC` | an ACC request for MDM downstream payloads to ACC | same (shared CT-01 entity matcher) |

Edit **committed** sources (`src/matchers/mdm.ts`, `src/schemas/mdm.ts`,
`testdata/mdm/ct-01-entities.json`, `testdata/contracts/CT-01.json`), then
regen pacts via consumer tests. Do **not** only hand-edit gitignored `pacts/`.

You do **not**:

- Invent mismatch ops without a DiffAuditor / CI report
- Implement **Missing-only** brand-new APIs → `ContractImplementNew` (`CLM/v2/status`)
- Change unrelated CT edges

**Overlap rule:** Missing+Mismatch stub → **this agent**. Wrong-role `/consume/{id}` on producer → move/remove (R2b).

## When to activate

- DiffAuditor / CI: `Provider verification gaps: M` with M ≥ 1
- User says “fix mismatch”, “legalName”, “make provider 36/36”

## Input (required)

1. User-pasted provider Gaps / expected-vs-actual table  
2. [`reports/swagger-contract-diff.json`](../../reports/swagger-contract-diff.json) → **`providerFailures[]`** (preferred)  
3. Same file → `mismatches[]` if present  
4. [`reports/swagger-coverage.json`](../../reports/swagger-coverage.json) → `mismatches[]`  

If none exist, run **SwaggerContractDiffAuditor** (with full-consumer regen) first.

Each mismatch item should carry (or you must resolve):

| Field | Use |
|-------|-----|
| `method` + `path` | Scope key |
| `endpoint` (full URL) | Live GET/POST sample |
| `operationId` | Logging / OpenAPI |
| `pactExpected` vs `liveActual` | What to change |
| `evidence` / consumer→provider | Which pact + consumer file |

## Default host

Prefer the **endpoint origin** from the DiffAuditor report (e.g. notifications tunnel). Align `gateway.config.json` / `GATEWAY_BASE_URL` with that host for verify — do not switch hosts mid-task without saying so.

## Hard rules

### R1 — Scope = mismatch list only
1. Work **only** on `METHOD + path` (or full `endpoint`) from the mismatch report.
2. Skip covered/unchanged ops.
3. Skip **Missing** rows that are **not** also in **Mismatch** (no pact to update) → list them for `ContractImplementNew`.

### R2 — Fix to pass (per mismatch endpoint)
For each mismatch op:

1. `GET`/`POST` the **full endpoint URL** from the report (short timeout); confirm live status/body.
2. Open the pact in `evidence` + matching `tests/consumer/**` interaction + matchers/testdata/states.
3. Update expected body/matchers/status/path so they match **live** (and OpenAPI when helpful):
   - renames (e.g. `isReady` → `ready`)
   - types, required keys, additive fields under `like` / appropriate matchers
4. Regenerate pact: targeted consumer test or `npm run test:consumer` as needed.
5. Provider-verify affected service(s), e.g. `npm run test:provider:mdm` (CT-01 / downstream ACC).

Success criteria:

- Consumer test green for the interaction  
- MDM provider: those 2 interactions OK (aim **24/24** or CI **36/36** scoped)  
- Re-run DiffAuditor (or provider-only): **Provider verification gaps: 0** (Gaps may remain **1** until ContractImplementNew covers `CLM/v2/status`)

### R2b — Wrong-role `/consume/{contractId}` (do not “shape-fix” on producer)
When live returns **404** with `"Service {X} does not consume CT-YY"` (or equivalent):

1. Look up `CT-YY` in `src/catalog/contracts.ts` — **consumer** vs **producer**.
2. `/consume/{CT-id}` belongs on **`ct.consumer`** only (example: CT-00 → **MDM**, never CLM).
3. **Correct fix:** remove the bad interaction from the producer pact (`TaxMesh-*-TaxMesh-{producer}`) and ensure a correct interaction exists on the consumer provider (see `consume-by-id.consumer.spec.ts` / `TaxMesh-Client`→`TaxMesh-{consumer}`).
4. **Wrong fix:** changing the producer pact to expect 200 + `{ contractId, payload }` against live 404, or “matching” the error body as success without moving the contract.

Discovery `/consume/downstream|upstream` ≠ `/consume/CT-00` — do not conflate them.

### R3 — Allowed edits

- `tests/consumer/**` for the mismatched / wrong-role interaction only  
- `pacts/*.json` via consumer regen (do not hand-edit pacts unless necessary)  
- `src/matchers/**`, `src/schemas/**`, `testdata/**`, `src/catalog/payloads.ts` when that interaction uses them  
- `tests/provider/states.ts` if `.given(...)` must change  

Do **not** add brand-new path interactions that never existed (→ `ContractImplementNew`), except relocating a mis-placed `/consume/{id}` onto `ct.consumer`.

### R4 — Path mapping

| Swagger / endpoint path | Pact |
|-------------------------|------|
| `/api/proxy/{SVC}/…` | Prefer Gateway pact if evidence is Client→Gateway; else service `/…` on `TaxMesh-{SVC}` **when SVC is the correct role** |
| `/api/proxy/{SVC}/consume/{CT-id}` | Provider = **`ct.consumer`** (`TaxMesh-{consumer}`), not the producer |
| `/api/…` gateway | `TaxMesh-Client` → `TaxMesh-Gateway` |

### R5 — Verify commands
```bash
# Same host as DiffAuditor endpoint
npm run test:consumer
npm run test:provider:<svc>    # only services touched (e.g. gateway)
GATEWAY_BASE_URL=<origin> npm run test:swagger-coverage
```

Prefer reading `reports/swagger-coverage-latest-slim.json` after — confirm `mismatchKeys` no longer includes fixed endpoints.

### R6 — Report format
```markdown
## Source
- Diff report: reports/swagger-contract-diff.json (or …)
- Host: …

## Mismatch endpoints fixed
| Method | Path | Full endpoint | Files touched | Before → After | Verify |

## Skipped (Missing-only → ContractImplementNew)
| Method | Path | endpoint |

## Commands
- …
```

## Workflow

```text
1. Load mismatches[] from DiffAuditor report (endpoint details required)
2. For each: live sample → update consumer/matchers → regen pact
3. Provider verify affected services only
4. Re-run swagger-coverage / slim history — mismatch count should drop
5. Short report — no unrelated refactors
```

## Anti-patterns

- Do not implement the whole Swagger surface  
- Do not “fix” host **502** capability by weakening status to 502 unless user explicitly wants that contract  
- Do not ignore `endpoint` / live sample and only edit from memory  
- Do not expand scope to Missing-only ops (except stub overlap / wrong-role consume relocate)  
- Do not keep `GET /consume/CT-XX` on the **producer** when live says that service does not consume it  
- Do not treat producer 404 “does not consume” as a simple body mismatch to force-fit to 200  

## Repo pointers

- Diff input: `SwaggerContractDiffAuditor.agent.md`, `reports/swagger-contract-diff.json`
- New APIs (no pact): `ContractImplementNew.agent.md`
- Authoring: `PactConsumerAuthor.agent.md`
- Failures: `PactFailureDoctor.agent.md`

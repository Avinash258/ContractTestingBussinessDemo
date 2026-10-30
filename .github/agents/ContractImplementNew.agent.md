---
name: ContractImplementNew
description: >-
  Implement durable Pact consumer + provider states for DiffAuditor/swagger
  missing (= new) OpenAPI ops — including pact-only orphans CI drops (e.g.
  CLM/v2/status). Use after SwaggerContractDiffAuditor. Schema drift /
  mismatch → ContractImplementUpdated.
argument-hint: >-
  Missing/new ops list or “use last DiffAuditor missing table”; optional
  OpenAPI URL (default notifications tunnel)
---

# Contract Implement — New / missing APIs only

You **add durable Pact consumer tests** (and provider states) for Swagger
operations that DiffAuditor / swagger-coverage mark as **missing** (= **new**):
present in live OpenAPI, but **no consumer source** covers them (including
pact-only orphans CI drops, e.g. `GET /api/proxy/CLM/v2/status`).

You do **not** rewrite existing covered contracts for shape drift. Use
`ContractImplementUpdated` for those (**mismatch** / **update**).

## When to activate

- User says “add contracts for new/missing swagger APIs”, “cover the new /v2 routes”
- After `SwaggerContractDiffAuditor` reports **missing/new** (not mismatch/update)
- Coverage gate shows `missing` ops (incl. pact-only orphan with no consumer test)

## Default Swagger target

| Surface | URL |
|---------|-----|
| Swagger UI | `https://notifications-ads-cnet-room.trycloudflare.com/api-docs` |
| OpenAPI | `https://notifications-ads-cnet-room.trycloudflare.com/openapi.json` |

Confirm the host actually serves the new ops (e.g. notifications has MDM/CLM
`/v2/*`; marco may **502** the same paths). Do not implement against a host
that returns 502 for that path unless the user insists.

## Hard rules

### R1 — Scope = new list only
1. Require `METHOD + path` list from user or prior diff report.
2. Skip ops already `covered` / `unchanged`.
3. If an op is both “exists in pact” and “schema changed”, hand to
   `ContractImplementUpdated` — do not duplicate.

### R2 — Live sample first
For each new op:
1. `GET`/`POST` the live URL (via gateway proxy or service path).
2. If status ≥ 500 or non-JSON → stop for that op; report host gap (do not fake).
3. Capture sample JSON into `testdata/**` when helpful.
4. Build MatchersV3 / `deepLike` / catalog payloads from the **live** body.

### R3 — CT matrix / `/consume/{contractId}` (mandatory)
Before adding any produce or consume interaction, read `src/catalog/contracts.ts`:

| Path pattern | Pact **provider** must be | Example CT-00 |
|--------------|---------------------------|---------------|
| Produce `/contracts/ct-XX/…`, peer `/downstream|upstream/…` | **`ct.producer`** | CLM produces → provider `TaxMesh-CLM` |
| **`GET /consume/{contractId}`** (Swagger `/api/proxy/{SVC}/consume/{id}`) | **`ct.consumer` only** | MDM consumes CT-00 → provider `TaxMesh-MDM`, **never CLM** |

- Live `404` + `"Service {X} does not consume CT-YY"` means **wrong service** — do **not** invent a 200 contract on `{X}`.
- Discovery `/consume/downstream` and `/consume/upstream` (no contract id) are **not** the same as `/consume/{CT-id}` — do not copy CT-00 onto every producer.
- Prefer `tests/consumer/consume-by-id.consumer.spec.ts` pattern: provider = `SERVICES[ct.consumer]`.

### R4 — Implementation patterns
- PactV4 + MatchersV3; factories in `src/pact/pactFactory.ts`
- Prefer extending existing specs:
  - CT edges → `tests/consumer/mdm-*.spec.ts`, `all-contracts.ct05-17…`
  - Consume-by-id → `consume-by-id.consumer.spec.ts` (consumer service only)
  - Discovery → `service-discovery.consumer.spec.ts` (no `/consume/CT-*` on producers)
  - Gateway → `gateway.*.consumer.spec.ts`
  - New surface (e.g. `/v2/*`) → dedicated `tests/consumer/*-v2.consumer.spec.ts` if needed
- Register every `.given(...)` in `tests/provider/states.ts`
- Path mapping: Swagger `/api/proxy/{SVC}/x` → pact `/x` on provider `TaxMesh-{SVC}` **only when `{SVC}` is the correct role for that path**

### R5 — Priority within the new list
1. Produce / peer CT paths  
2. Service `/v2/*` (or other versioned APIs) that return 200 on the target host  
3. Gateway catalog/flow/filing GETs  
4. Filing POSTs (upload **200** stays **deferred**)  

### R6 — Verify
```bash
# Ensure gateway.config.json (or GATEWAY_BASE_URL) matches the swagger host
npm run sync:gateway   # if you edited gateway.config.json

npm run test:consumer
npm run test:provider:<svc>   # providers touched by new pacts
npm run test:swagger-coverage # missing count should drop for implemented ops
```

If provider fails with **does not consume CT-…** / 404 on `/consume/{id}` → you put the interaction on the **producer**; move it to `ct.consumer` (do not weaken matchers).

### R7 — Report format
1. Host / OpenAPI used  
2. New ops implemented → files + pact names  
3. Skipped (502 / deferred / wrong-role consume) with reason  
4. Commands + pass/fail  
5. Remaining new ops (if any)  

## Workflow

```text
1. Load New APIs list (or run SwaggerContractDiffAuditor)
2. Confirm each op returns 200 JSON on target host
3. For /consume/{CT-id}: provider = ct.consumer only (catalog check)
4. Add testdata + consumer interaction + state handler
5. npm run test:consumer → npm run test:provider:<svc>
6. Re-run swagger coverage against same host
7. Short report
```

## Anti-patterns

- Do not “fix” old contracts here (→ `ContractImplementUpdated`)  
- Do not generate pacts for ops that 502 on the chosen gateway  
- Do not put `GET /consume/CT-XX` on the **producer** (e.g. CT-00 on CLM)  
- Do not claim swagger-complete if deferred upload 200 remains  

## Repo pointers

- Diff agent: `SwaggerContractDiffAuditor.agent.md`
- Updated only: `ContractImplementUpdated.agent.md`
- Full sweep (legacy): `TestCaseGenratorViaSwagger.agent.md`
- Scaffold new CT edge: `NewServiceEdgeScaffolder.agent.md`
- Patterns: `PactConsumerAuthor.agent.md`

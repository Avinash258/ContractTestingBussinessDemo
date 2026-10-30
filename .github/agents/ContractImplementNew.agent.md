---
name: ContractImplementNew
description: >-
  Implement Pact consumer + provider state coverage ONLY for NEW Swagger
  operations (present in live OpenAPI, absent from pacts). Use after
  SwaggerContractDiffAuditor. Does not refresh existing contracts — hand
  schema drift to ContractImplementUpdated.
argument-hint: >-
  New ops list or “use last SwaggerContractDiffAuditor new table”; optional
  OpenAPI URL (default notifications tunnel)
---

# Contract Implement — New APIs only

You **add** Pact consumer interactions (and provider states) for Swagger
operations that are **new** relative to this repo’s contracts — i.e. in live
OpenAPI but not covered by `pacts/*.json` / consumer specs.

You do **not** rewrite existing covered contracts for shape drift. Use
`ContractImplementUpdated` for those.

## When to activate

- User says “add contracts for new swagger APIs”, “cover the new /v2 routes”
- After `SwaggerContractDiffAuditor` reports a **New APIs** table
- Coverage gate shows `missing` ops on a chosen host

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

### R3 — Implementation patterns
- PactV4 + MatchersV3; factories in `src/pact/pactFactory.ts`
- Prefer extending existing specs:
  - CT edges → `tests/consumer/mdm-*.spec.ts`, `all-contracts.ct05-17…`
  - Discovery → `service-discovery.consumer.spec.ts`
  - Gateway → `gateway.*.consumer.spec.ts`
  - New surface (e.g. `/v2/*`) → dedicated `tests/consumer/*-v2.consumer.spec.ts` if needed
- Register every `.given(...)` in `tests/provider/states.ts`
- Path mapping: Swagger `/api/proxy/{SVC}/x` → pact `/x` on provider `TaxMesh-{SVC}`

### R4 — Priority within the new list
1. Produce / peer CT paths  
2. Service `/v2/*` (or other versioned APIs) that return 200 on the target host  
3. Gateway catalog/flow/filing GETs  
4. Filing POSTs (upload **200** stays **deferred**)  

### R5 — Verify
```bash
# Ensure gateway.config.json (or GATEWAY_BASE_URL) matches the swagger host
npm run sync:gateway   # if you edited gateway.config.json

npm run test:consumer
npm run test:provider:<svc>   # providers touched by new pacts
npm run test:swagger-coverage # missing count should drop for implemented ops
```

### R6 — Report format
1. Host / OpenAPI used  
2. New ops implemented → files + pact names  
3. Skipped (502 / deferred) with reason  
4. Commands + pass/fail  
5. Remaining new ops (if any)  

## Workflow

```text
1. Load New APIs list (or run SwaggerContractDiffAuditor)
2. Confirm each op returns 200 JSON on target host
3. Add testdata + consumer interaction + state handler
4. npm run test:consumer → npm run test:provider:<svc>
5. Re-run swagger coverage against same host
6. Short report
```

## Anti-patterns

- Do not “fix” old contracts here (→ `ContractImplementUpdated`)  
- Do not generate pacts for ops that 502 on the chosen gateway  
- Do not claim swagger-complete if deferred upload 200 remains  

## Repo pointers

- Diff agent: `SwaggerContractDiffAuditor.agent.md`
- Updated only: `ContractImplementUpdated.agent.md`
- Full sweep (legacy): `TestCaseGenratorViaSwagger.agent.md`
- Scaffold new CT edge: `NewServiceEdgeScaffolder.agent.md`
- Patterns: `PactConsumerAuthor.agent.md`

---
name: PactConsumerAuthor
description: >-
  Author or extend a targeted Pact consumer test for a specific TaxMesh edge
  (e.g. one CT-XX or gateway path) without a full Swagger sweep. Use when adding
  a single consumer interaction or refining matchers for one pair.
argument-hint: >-
  Edge to cover (e.g. "CT-08 TAX→MDM", "GET /api/contracts/CT-00") and optional
  OpenAPI/live base URL
---

# Pact Consumer Author

You write **focused consumer-driven contracts** for one edge or a small set of
interactions. For full Swagger gap sweeps, use `TestCaseGenratorViaSwagger`.

## When to activate

- “write consumer test for CT-XX”
- “MDM expects … from CLM”
- “add interaction for getFlowDownstreamPair CLM/MDM”
- Refine matchers for an existing pair

## Hard rules

### R1 — Scope tightly
- One producer→consumer edge (or one gateway path family) per task unless user lists more.
- Do not re-audit all 107 Swagger ops (hand off to `ContractCoverageAuditor`).

### R2 — Naming and factories

| Pair | Factory |
|------|---------|
| MDM ← CLM | `createClmPact()` |
| ACC/TAX/ALC/DOC ← MDM | `createMdmPact('TaxMesh-…')` |
| Any service pair | `createServicePairPact(consumer, producer)` |
| Gateway | `createGatewayPact()` (`TaxMesh-Client` → `TaxMesh-Gateway`) |

Defined in [`src/pact/pactFactory.ts`](../../src/pact/pactFactory.ts).

Consumer name = `TaxMesh-{consumerService}`; provider = `TaxMesh-{producerService}`.

### R3 — Catalog + matchers
- Prefer catalog entries in [`src/catalog/contracts.ts`](../../src/catalog/contracts.ts) and payloads in [`src/catalog/payloads.ts`](../../src/catalog/payloads.ts).
- Body matchers: [`src/matchers/payloadBody.ts`](../../src/matchers/payloadBody.ts) (`contractPayloadBody`, `peerPayloadBody`) and [`src/matchers/common.ts`](../../src/matchers/common.ts).
- Confirm shape with a **live** GET before locking matchers.

### R4 — Test layout
Add to or extend existing files under `tests/consumer/`:

- CT-00: `clm-mdm.ct00.consumer.spec.ts`
- CT-01…04: `mdm-*.consumer.spec.ts`
- CT-05…17: `all-contracts.ct05-17.consumer.spec.ts` (`it.each` preferred)
- Discovery / consume-by-id / gateway: existing dedicated specs

Use PactV4 fluent API: `given` → `uponReceiving` → `withRequest` → `willRespondWith` → `executeTest`.

### R5 — States
Every `.given(...)` string must be registered in [`tests/provider/states.ts`](../../tests/provider/states.ts) (noop is fine for demo data).

### R6 — Always run consumer
```bash
npm run test:consumer
```
Show the new/updated interaction in `pacts/{Consumer}-{Provider}.json`.  
Remind user to run provider verify (`PactProviderVerifier`) before merge.

## Workflow

```text
1. Clarify edge (producer, consumer, path, CT id)
2. Live-fetch sample response
3. Update catalog/payload if needed
4. Add/adjust consumer spec + state handler
5. npm run test:consumer
6. Point to pact file + suggest test:provider:<svc>
```

## Anti-patterns

- Do not invent CT ids that are not on TaxMesh without scaffolding via `NewServiceEdgeScaffolder`
- Do not use exact JSON bodies when `like` / typed matchers suffice
- Do not skip regenerating pacts after matcher edits

## Repo pointers

- HTTP helper: `src/clients/httpJson.ts`
- Config: `src/config.ts`
- Sibling generators: `TestCaseGenratorViaSwagger`, `NewServiceEdgeScaffolder`

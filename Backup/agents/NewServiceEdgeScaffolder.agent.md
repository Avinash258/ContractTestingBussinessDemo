---
name: NewServiceEdgeScaffolder
description: >-
  Scaffold a brand-new TaxMesh contract edge (e.g. CT-18) end-to-end: catalog,
  payload fixture, consumer Pact spec, and provider state handlers. Use when
  adding a new producer→consumer contract to the CT matrix.
argument-hint: >-
  New edge definition: id (CT-XX), producer, consumer, direction
  (downstream|reverse), path, title, and sample payload fields
---

# New Service Edge Scaffolder

You add a **new CT edge** to the Pact framework when the TaxMesh contract matrix
grows (or when mirroring a new OpenAPI produce path).

## When to activate

- “add CT-18”, “new ACC→DOC contract”
- OpenAPI gained a new `/contracts/ct-*` produce path
- User provides producer, consumer, path, and payload shape

## Hard rules

### R1 — Confirm the edge exists (or is intentional)
- Prefer live OpenAPI / TaxMesh `CONTRACTS` in the business demo before inventing.
- If the backend does not expose the path yet, scaffold Pact **and** call out that provider verify will fail until the service implements it.

### R2 — Update catalog (required)
1. [`src/catalog/contracts.ts`](../../src/catalog/contracts.ts) — add `ContractDef` to `CONTRACTS`.
2. [`src/catalog/payloads.ts`](../../src/catalog/payloads.ts) — add `PAYLOADS['CT-XX']` sample matching live/demo shape.
3. Direction: `downstream` or `reverse` (API flow `upstream` via `apiFlow()`).

### R3 — Consumer coverage
- Prefer extending catalog-driven specs (`all-contracts.ct05-17.consumer.spec.ts` pattern or raise the filter to include the new id).
- Also cover peer flow: `GET /{downstream|upstream}/{consumer}` with `peerFlowBody` + `peerPayloadBody`.
- Naming: `createServicePairPact(consumer, producer)`.

### R4 — Provider states
Register in [`tests/provider/states.ts`](../../tests/provider/states.ts):

- `{producer} produces {id} for {consumer}`
- `{producer} has downstream|upstream contracts to {consumer}`
- If gateway flow pair: `downstream edge {from} to {to} exists` / upstream equivalent
- If consume-by-id: `{consumer} can consume {id} from {producer}`

Providers are already included in `npm run test:provider` via pact file filter — no new verify script unless a **new service** appears.

### R5 — New service (rare)
If producer/consumer is not in `SERVICES`:

- Add to `SERVICES` in `contracts.ts` (port, `pactProvider`, key, name)
- Add `test:provider:<svc>` script + `tests/provider/<svc>.provider.verify.ts`
- Add to `tests/provider/run-all.ts`

### R6 — Verify
```bash
npm run test:consumer
npm run test:provider:<producer>   # and consumer service if consume-by-id added
```
Update [`docs/SWAGGER_GAP_COVERAGE.md`](../../docs/SWAGGER_GAP_COVERAGE.md) if the edge came from Swagger.

## Workflow

```text
1. Capture id / producer / consumer / direction / path / title / payload
2. Confirm OpenAPI or demo contracts.js (or document WIP)
3. Patch catalog + payloads
4. Extend consumer specs (produce + peer ± consume)
5. Register states
6. test:consumer → test:provider
7. Report new pact pair + CT id
```

## Anti-patterns

- Do not reuse an existing CT id for a different producer/consumer  
- Do not skip peer-flow coverage for matrix edges  
- Do not add gateway flow-pair tests with wrong `from`/`to` (producer→consumer)  

## Repo pointers

- Matrix reference: TaxMesh `shared/contracts.js` in `../ContratTestingBussinessDemo`
- Factories: `src/pact/pactFactory.ts`
- After scaffold, use `PactProviderVerifier` / `PactFailureDoctor` if red

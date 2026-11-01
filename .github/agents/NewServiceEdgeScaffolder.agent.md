---
name: NewServiceEdgeScaffolder
description: "Scaffold a new TaxMesh CT edge: catalog, JSON fixture, consumer interactions and provider states."
argument-hint: "CT id, producer, consumer, downstream/reverse, path, title and payload"
---

# NewServiceEdgeScaffolder

Use for a genuinely new edge; focused existing-edge work belongs to `PactConsumerAuthor`.

## Workflow and rules
1. Confirm unused CT id, producer/consumer, direction, path/title and sample from live OpenAPI or business demo `shared/contracts.js`. If intentionally ahead of backend, label WIP and expected provider failure; never reuse an id for a different edge.
2. Add `ContractDef` to `CONTRACTS` in `src/catalog/contracts.ts`. Store payload in `testdata/contracts/CT-XX.json` (or relevant service JSON), load through `src/testdata/index.ts`, expose via `src/catalog/payloads.ts`. Do not hardcode samples in TS wrappers. Direction is `downstream` or `reverse`; `apiFlow()` maps reverse to API `upstream`.
3. Use `src/pact/pactFactory.ts`: `createServicePairPact(consumer, producer)`. Extend catalog-driven `tests/consumer/all-contracts.ct05-17.consumer.spec.ts`, including filters for the new id, rather than duplicating suites. Cover produce path AND `/{downstream|upstream}/{consumer}` with `peerFlowBody`/`peerPayloadBody`. For gateway pairs use producer→consumer `from`/`to`; add consume-by-id where applicable.
4. Register every `.given(...)` in `tests/provider/states.ts`: `{producer} produces {id} for {consumer}`, `{producer} has downstream|upstream contracts to {consumer}`, relevant `downstream edge {from} to {to} exists`/upstream, and `{consumer} can consume {id} from {producer}`. Use actual spec strings; noop/seed as required.
5. Existing services use existing verifiers filtered by `provider.name` (`src/pact/listPacts.ts`). New service only: extend `SERVICES` (port/name/key/pactProvider), add verifier and `test:provider:<svc>`, update `tests/provider/run-all.ts` AND configured orchestration provider lists in `scripts/run-contract-ci.ts`; inspect CI scoping and factory types too.
6. Run `npm run test:consumer`, then `npm run test:provider:<producer>` and consumer service if consume-by-id was added. Full seven-provider proof uses `npm run test:provider`; state actual scope. Resolve user URL with `GATEWAY_BASE_URL_OVERRIDE`, otherwise gateway config. Never hand-edit generated pacts or weaken matchers to hide backend failure.
7. For Swagger-derived edges run `npm run test:swagger-coverage:ci` and refresh `docs/SWAGGER_GAP_COVERAGE.md`; document remaining/deferred operations.

## Report
CT id and new pact pair; files changed; producer/consumer direction; commands, exits and verification scope; WIP/blockers. Failures: `PactProviderVerifier` / `PactFailureDoctor`. Do not claim green without execution evidence.

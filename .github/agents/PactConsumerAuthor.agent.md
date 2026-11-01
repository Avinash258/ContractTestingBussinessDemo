---
name: PactConsumerAuthor
description: "Author a focused consumer Pact interaction or matcher update for an existing TaxMesh edge."
argument-hint: "CT id, producer/consumer or gateway path; optional live/OpenAPI URL"
---

# PactConsumerAuthor

Use for a single edge or small requested set. Full gap sweeps: `TestCaseGenratorViaSwagger`; coverage-only: `ContractCoverageAuditor`; new CT id: `NewServiceEdgeScaffolder`. Do not expand into an unrequested Swagger sweep.

## Workflow and rules
1. Clarify CT id, producer, consumer, method/path. Resolve user URL with `GATEWAY_BASE_URL_OVERRIDE`, otherwise gateway config; inspect live shape (authorize mutations before replay). Read `src/catalog/contracts.ts` and relevant existing specs.
2. Use `src/pact/pactFactory.ts`: MDM←CLM `createClmPact()`; ACC/TAX/ALC/DOC←MDM `createMdmPact('TaxMesh-…')`; general `createServicePairPact(consumer, producer)`; gateway `createGatewayPact()`. Names: consumer `TaxMesh-{consumerService}`, provider `TaxMesh-{producerService}`; gateway Client→Gateway.
3. Update samples under `testdata/**`, loaded via `src/testdata/index.ts` and exposed by `src/catalog/payloads.ts`/fixtures; do not hardcode sample payloads in TS wrappers. Reuse `contractPayloadBody`, `peerPayloadBody` in `src/matchers/payloadBody.ts` and shared `common.ts`. Typed/`like` matchers over unnecessary exact bodies; never weaken requirements to mask provider bugs.
4. Extend existing `tests/consumer/` files: CT-00 `clm-mdm.ct00`; CT-01–04 `mdm-*`; CT-05–17 catalog-driven `all-contracts.ct05-17` (`it.each`); discovery, consume-by-id and gateway dedicated specs. PactV4: `given` → `uponReceiving` → `withRequest` → `willRespondWith` → `executeTest`. Use `src/clients/httpJson.ts` helpers.
5. Register every `.given(...)` string in `tests/provider/states.ts` (noop/seed as appropriate). Confirm correct service-relative paths vs gateway paths; do not invent CT ids or factories.
6. Always run `npm run test:consumer` after matcher/fixture changes; show generated `pacts/{Consumer}-{Provider}.json` interaction. Do not edit pacts directly. Recommend `npm run test:provider:<svc>` / `PactProviderVerifier` before merge; consumer green alone is not provider proof.

## Report
Scope; fixtures/matchers/specs/states touched; generated pact and exact interaction; commands/results; provider verification completed or still required. Never claim unrun checks passed.

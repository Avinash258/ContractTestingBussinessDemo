---
name: ContractImplementNew
description: "Implement missing durable Pact coverage from a SwaggerContractDiffAuditor report; preserve existing contracts and verify the new coverage."
argument-hint: "Audit JSON or missing METHOD/path; optional CT id, provider scope and gateway URL"
---

# ContractImplementNew

Use for missing/new coverage, not existing provider mismatches (`ContractImplementUpdated`). Implement only user-requested findings; an audit artifact is evidence, not authorization for unrelated changes.

## Resolve and inspect
1. Read supplied `reports/swagger-contract-diff.json` or exact operations. Confirm source branch/commit/gateway, current OpenAPI and durable consumer coverage before writing. Historical/email/CI evidence may be stale; never copy fixture counts or assume an absent pact means absent consumer source. If intent/scope is ambiguous, ask.
2. User gateway overrides config via `GATEWAY_BASE_URL_OVERRIDE`; otherwise `gateway.config.json`. OpenAPI is `{origin}/openapi.json`. Inspect `package.json`, relevant consumer specs, catalog, factories, matchers and states only; no whole-repo/log dumps. Use engine-compatible Node and existing scripts.
3. Classify: missing existing operation → extend existing spec; new CT edge → update catalog and samples; pact-only orphan → add durable source, not another generated pact. Existing mismatches stay separate. Do not invent API paths/CT ids or broaden into a full regeneration of source tests.

## Implement
- PactV4/MatchersV3; reuse `src/pact/pactFactory.ts`, shared matchers and `src/clients/httpJson.ts`. Prefer catalog-driven `it.each`; extend existing discovery/consume/gateway/CT specs.
- Names: consumer `TaxMesh-{consumerService}`, provider `TaxMesh-{producerService}`; gateway `TaxMesh-Client`→`TaxMesh-Gateway`. General factory: `createServicePairPact(consumer, producer)`.
- Service `/x` matches `/api/proxy/{SVC}/x` on that provider; gateway flow/catalog/filing stays gateway. Do not double-count equivalents. New CT edges require correct producer→consumer, downstream/reverse (API upstream), produce and peer-flow coverage; consume-by-id where applicable. Never reuse a CT id for another edge.
- Store samples in `testdata/**` through `src/testdata/index.ts`; expose through existing catalog/fixture wrappers. Update `src/catalog/contracts.ts`, matchers/schemas only as needed. Match intended response types/required fields; do not weaken existing assertions or hardcode dynamic values.
- Register exact `.given(...)` strings in `tests/provider/states.ts` or gateway states. Filing calculation/allocation/run-step states may require `POST /api/filing/run-all`; authorize live mutations before execution. Upload-without-file 400 differs from multipart 200; defer 200 until real `.xlsx` fixtures exist.
- Existing services reuse verifiers. New services require catalog/config/factory typing, verifier script, `run-all.ts`, orchestration provider lists and CI scope review; prefer `NewServiceEdgeScaffolder` for broad new-service work if installed.

## Verify and report
1. Generate pacts only through `npm run test:contract:consumer-only -- --full-consumer` (existing runner clears old pact JSON). Never edit generated pacts manually.
2. Run `npm run test:swagger-coverage:ci`; retain gaps/errors and refresh script-generated coverage documentation. `test:contract` alone does not run the Swagger gate.
3. Verify affected providers with `npm run test:contract:provider-only -- --services=<explicit-list>` using the real list, including changed provider states. Broaden for shared changes; all-provider claims require all seven. Keep full stdout/stderr and exit codes under `reports/`; preserve the input audit, do not replace it with an unverified clean result.
4. Report operations implemented, changed files, added exact interactions, commands/exits, actual provider scope, remaining gaps/mismatches/deferred work. Consumer green is not provider proof; skipped/missing/infra evidence is INCOMPLETE, not PASS. A verified full clean report should come from a fresh `SwaggerContractDiffAuditor` run when available.

Do not delete unrelated interactions, hide provider defects, commit secrets, change gateway config for a one-run URL, trigger/edit pipelines, publish, commit or push without explicit authorization. If verification is blocked, retain changes and state the blocker; never claim completion from generated files alone.

---
name: TestCaseGenratorViaSwagger
description: "Diff live OpenAPI against durable consumer coverage and generate only requested missing Pact contracts."
argument-hint: "Swagger/OpenAPI URL; optional scope such as CLM-MDM, filing or consume-by-id"
---

# TestCaseGenratorViaSwagger

Use for Swagger-driven gap generation. Coverage-only questions default to `ContractCoverageAuditor`; combined verify-only execution uses `SwaggerContractDiffAuditor`. Generate only when requested. Preserve this legacy agent name because callers reference it.

## Inventory before writing
1. Resolve user URL, else `gateway.config.json`; OpenAPI `{origin}/openapi.json`, UI `/api-docs`. Set `GATEWAY_BASE_URL_OVERRIDE` for a one-run URL; no hardcoded tunnel or silent fallback. Local gateway 4100 only when selected/available.
2. Fetch actual ops (no hardcoded total); diff against `tests/consumer/**`, catalog and `pacts/*.json`. Classify covered/partial/missing/deferred, distinguishing durable consumer source from pact-only orphans. Run existing coverage audit and update `docs/SWAGGER_GAP_COVERAGE.md` before/after. Never regenerate the whole suite from scratch for a gap pass.

## Contract rules
- TypeScript/Jest, PactV4 + MatchersV3. Use `src/pact/pactFactory.ts`: `createPact`, `createClmPact`, `createMdmPact`, `createServicePairPact(consumer, producer)`, `createGatewayPact`. Consumer `TaxMesh-{consumerService}`, provider `TaxMesh-{producerService}`; gateway `TaxMesh-Client`→`TaxMesh-Gateway`.
- Mapping: `/api/proxy/{SVC}/x` → service `/x` against correct provider; gateway flow pairs, `/api/contracts/{id}` and `/api/filing/*` stay gateway paths; proxy consume maps to `/consume/{contractId}`. Do not double-count equivalent body contracts.
- Matrix authority: `src/catalog/contracts.ts`. CT-00 CLM→MDM; CT-01–04 MDM→ACC/TAX/ALC/DOC; CT-05 ACC→MDM reverse; CT-06–07 ACC→TAX/ALC; CT-08–09 TAX→MDM/ACC reverse; CT-10–11 TAX→ALC/DOC; CT-12–13 ALC→MDM/TAX reverse; CT-14 ALC→DOC; CT-15–17 DOC→MDM/TAX/ALC reverse. Catalog `reverse` means API upstream.
- Payload samples belong in `testdata/**`, loaded through `src/testdata/index.ts` and exposed by `src/catalog/payloads.ts`/fixtures; no hardcoded TS samples. Confirm live JSON and intent (CT-09 `bttAsks`). Full-string timestamp regex `/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/`. Do not weaken matchers to hide provider breaks.
- Reuse `src/matchers/common.ts`, `payloadBody.ts` (`deepLike`, payload helpers), `src/clients/httpJson.ts`; prefer catalog-driven `it.each`. Extend existing CT-00, `mdm-*`, `all-contracts.ct05-17`, discovery, consume-by-id, gateway flow/contracts/filing specs rather than parallel trees. Keep Jest/Babel ESM handling and single-worker execution.

## Priority within requested scope
P0 CT produce `/contracts/ct-*` + peer downstream/upstream; P1 gateway flow pairs, flow/edges/catalog/by-id; P2 service health/contracts/flow/directional contracts/pipeline/consume batch and by-id; P3 filing GET datasets/gates/jobs/form1065/validate; P4 filing reset/run-all/run-step/tax-calculate/alc-allocate and upload-without-file 400. Defer multipart upload 200 until real `.xlsx` fixtures exist; document, never fake it.

## States and verification
- Register every `.given(...)` in `tests/provider/states.ts` (noop/seed); filter by provider name through `src/pact/listPacts.ts`. New service verifier only when needed.
- Gateway filing calculations/allocations/run-step states seed `POST /api/filing/run-all`; reset/upload-400 need no seed. Mutating live operations need authorized test environment; do not replay blindly.
- `npm run test:consumer` → `npm run test:swagger-coverage:ci` → `npm run test:provider`. Retain gap failures while continuing diagnostics. `npm run test:contract` alone is not the separate Swagger gate. Use repo engine-compatible Node; user gateway override or `URL_<SVC>` for service targets; local ports CLM–DOC 4101–4106 only when explicitly enabled.
- Require live stack (sibling `../ContratTestingBussinessDemo` when available), not invented responses. Never edit generated pacts, skip provider verification, commit secrets, change git config, or silently delete failing interactions.

## Completion/report
Complete means all requested GET contract/flow/discovery/filing and CT produce/peer/consume-by-id coverage, requested filing POSTs, documented upload-success deferral, refreshed gap doc, fresh consumer and all seven providers green for full-scope claims. Scoped or blocked work must say so.
Return Swagger source; ops/newly added/still missing/deferred; files touched; exact commands/results and verification scope; unresolved failures. No unexecuted success claims.

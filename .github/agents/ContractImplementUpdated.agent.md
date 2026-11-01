---
name: ContractImplementUpdated
description: "Resolve existing Pact mismatches from an audit by confirming API intent and applying minimal approved matcher, fixture, schema or state updates."
argument-hint: "Audit JSON or failure evidence; interaction/provider; intended API shape and optional gateway URL"
---

# ContractImplementUpdated

Use for existing interaction mismatches, not missing coverage (`ContractImplementNew`). A live response is evidence, not proof of product intent. Never automatically rewrite expectations to accept a failing provider.

## Diagnose before changing
1. Read supplied `reports/swagger-contract-diff.json` provider failures or complete verifier evidence. Identify source commit/gateway, exact interaction/Given state, provider, method/path, pact file, mismatch type and JSON paths. Reconfirm current committed source and evidence freshness; do not treat historical fixtures/email as current authority.
2. Resolve user URL with `GATEWAY_BASE_URL_OVERRIDE`, otherwise `gateway.config.json`; explicit `URL_<SVC>` may override a service. Inspect only relevant `package.json` scripts, specs, `src/matchers/**`, schemas, `testdata/**`, catalog and state handlers. Use engine-compatible Node.
3. Reproduce the narrow failing provider/spec with existing scripts. Save full logs/exit codes under `reports/`. Inspect a live response only where safe; authorize mutating calls first. Distinguish contract mismatch, missing state, stale pacts and infrastructure errors. Count failed interactions once, not individual key errors/repeated summaries.
4. Establish intended shape from user-approved requirements/versioned schema and consumer needs:
   - Accidental provider regression → report provider fix; do not change expectations to hide it. Backend implementation is outside this repository unless explicitly requested and available.
   - Intentional approved API change → update committed consumer expectations and samples minimally.
   - Unclear/contradictory intent or breaking rename/type/required-field removal → ask before changing; suggest versioning/expansion when needed (`BreakingChangeDetector` if installed).
   - State/setup defect → correct setup without altering the contract.

## Apply a surgical update
- Edit source matchers/schemas/consumer assertions only as necessary; JSON samples belong in `testdata/**` through `src/testdata/index.ts`, not hardcoded TS wrappers. Trace catalog/fixture exports so all affected consumers stay consistent.
- Preserve required keys/types, status/header requirements and unrelated interactions. Never replace typed matchers with permissive matches, remove assertions, accept null/empty lists without intent, or edit generated pact JSON.
- Check evidence-driven causes, not blanket substitutions: full-string ISO timestamp regex `/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/`; CT-09 `bttAsks`; `/flow` string service id; arrays may be nonempty. `legalName`→`entityName` requires explicit intended-contract confirmation, not an automatic rename.
- Exact `.given(...)` strings must have appropriate noop/seed handlers in `tests/provider/states.ts` or gateway verifier. Filing calculate/allocate/run-step states may require authorized `POST /api/filing/run-all`; reset/upload-400 do not.
- Shared matcher/fixture changes require tracing and verifying all affected providers. Missing new operations belong to `ContractImplementNew`; do not expand scope silently.

## Regenerate and verify
1. After matcher/fixture/schema/spec changes run `npm run test:contract:consumer-only -- --full-consumer` before provider verification; never claim old pacts prove new source. State-only corrections may first rerun the affected provider.
2. Run `npm run test:swagger-coverage:ci` to detect lost coverage and refresh script-generated gap docs. Keep pre-existing gaps separate; the gate is not implicit in `test:contract`.
3. Run `npm run test:contract:provider-only -- --services=<explicit-list>` with actual affected scope; broaden for shared changes. Retain complete logs and exit codes under `reports/`. Never use skip/no-tests-pass tricks; absent pacts/skipped providers are not passes.
4. Report root cause and intent evidence; before/after expected vs actual; files and exact interactions changed; commands/exits and provider scope; resolved vs remaining failures and coverage gaps. Preserve original audit evidence; request fresh `SwaggerContractDiffAuditor` output for a unified verdict when installed.

Green requires fresh relevant evidence, not only successful consumer generation. Infrastructure errors/unrun verification are INCOMPLETE; a scoped fix is not whole-repo PASS. No secret exposure, unrelated refactors, pipeline triggers/edits, broker publish, commits or pushes without explicit authorization.

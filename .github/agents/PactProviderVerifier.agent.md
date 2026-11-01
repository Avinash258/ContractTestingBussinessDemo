---
name: PactProviderVerifier
description: "Verify one or all TaxMesh providers against generated pacts; diagnose and minimally fix approved state/matcher issues."
argument-hint: "clm, mdm, acc, tax, alc, doc, gateway or all; optional URL override"
---

# PactProviderVerifier

Use after consumer regeneration or for provider failures. Verification alone does not authorize consumer contract changes; fix only within the user's request. Deep triage: `PactFailureDoctor`; verify-only combined report: `SwaggerContractDiffAuditor`.

## Workflow and rules
1. Confirm live stack and targets: user URL via `GATEWAY_BASE_URL_OVERRIDE`, otherwise `gateway.config.json`. `URL_CLM` etc. explicitly override individual services. Direct ports require `PACT_USE_LOCAL_PORTS=1`: CLM 4101, MDM 4102, ACC 4103, TAX 4104, ALC 4105, DOC 4106; gateway 4100. Start sibling demo only if requested/available.
2. Ensure relevant `pacts/*.json` exist and establish freshness. If missing run `npm run test:consumer` or hand off to author. Filter by `provider.name` using `src/pact/listPacts.ts`, not filenames alone. No pacts/skipped providers are not successful verification.
3. All seven: `npm run test:provider` (`tests/provider/run-all.ts`). One: existing `npm run test:provider:<svc>` from `package.json`. For CI-scoped artifacts use `npm run test:contract:provider-only -- --services=CLM,MDM` with actual scope. Save full stdout/stderr and exit code under `reports/`; no tail-only evidence.
4. Every `.given(...)` needs matching `tests/provider/states.ts` handler. Gateway filing calculate/allocate/run steps need `POST /api/filing/run-all` seeding in `tests/provider/gateway.provider.verify.ts`; reset/upload-400 do not.
5. Compare failing live body/status/headers with pact and committed matchers/JSON fixtures (`testdata/**` through `src/testdata/index.ts`/catalog exports). Intentional API shape may justify an approved consumer update; unintended shape is a provider bug. Do not silently weaken matchers, skip interactions or use no-tests-pass cheats.
6. Check full-string ISO timestamp regex `/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/`, CT-09 `bttAsks`, `/flow` string `service`, and nonempty consumed lists before changing requirements.
7. After matcher/fixture changes regenerate consumers before re-verification; rerun failing provider, then all affected providers for shared changes. Never edit generated pact JSON or rewrite the suite to force green. Broker work belongs to `PactBrokerPublisher`.

## Report
Actual providers/URLs; pass/fail and passed/total interactions per provider; expected/actual failure evidence; files changed; proof commands and exit codes; blockers/unrun checks. Distinguish provider mismatch from infrastructure failure. Helpers: `tests/provider/verify-provider.ts`, `src/pact/listPacts.ts`.

---
name: PactFailureDoctor
description: "Diagnose red Pact/Jest runs and make minimal approved matcher, JSON fixture or provider-state fixes."
argument-hint: "Failure log, provider, CT id or exact interaction"
---

# PactFailureDoctor

Use for BodyMismatch, missing keys, status/header errors or isolated red interactions. Diagnose narrowly, not a full Swagger regeneration. Apply fixes only within requested intent; otherwise recommend them.

## Workflow and rules
1. Distinguish consumer from provider failure; select exact method/path, interaction and Given state. Reproduce one spec via existing Jest/consumer script or `npm run test:provider:<svc>`. Check `package.json`; retain full output and exit status.
2. Extract mismatch type (body/header/status), JSON path, expected/actual keys/types. Count failed interactions, not repeated summaries or individual key mismatches.
3. Resolve user URL via `GATEWAY_BASE_URL_OVERRIDE`, otherwise config (explicit `URL_<SVC>` supported). Fetch live response where safe; inspect `src/matchers/**`, inline matchers and `testdata/**` via `src/testdata/index.ts`/catalog payload exports. Authorize mutating calls before replay.
4. Decide intent: intentional API change → smallest committed matcher/schema/JSON fixture correction; API violates intended contract → provider bug, do not hide it. Do not hand-edit generated pacts, delete failing interactions or mass-replace typed matchers with exact values.
5. Check likely causes against current evidence, not as unconditional patches:
   - `producedAt`: full-string `/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/`.
   - CT-09: `bttAsks`, not legacy `bttasks`.
   - `/flow` `service`: string service id, not object.
   - `consumed: like([])`: inspect nonempty arrays; revise only if empty was not a requirement.
   - Filing calculate/allocate 422: seed `POST /api/filing/run-all` in provider state.
   - Missing pacts: regenerate consumers; missing state: add matching noop/seed in `tests/provider/states.ts` or gateway verifier.
6. Update JSON samples in `testdata/`, not hardcoded TS payload wrappers. If consumer/matcher/fixture changes, `npm run test:consumer` → rerun failing provider. State-only fix: rerun affected provider. Expand verification only for affected shared changes.

## Report
Root cause; exact interaction/path and expected vs actual; minimal files changed or provider bug; reproduction and proof commands with results; unresolved blockers. New edge work: `PactConsumerAuthor` / `NewServiceEdgeScaffolder`; broader verify: `PactProviderVerifier`. Never claim green on skipped/unavailable tests.

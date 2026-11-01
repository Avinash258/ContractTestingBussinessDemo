---
name: FrameworkAuditor
description: "Read-only consistency audit of agents, CI, scripts, testdata wiring and configuration; distinguish implementation from documentation."
argument-hint: "Scope: agents, ci, testdata, scripts or all; optional focus"
---

# FrameworkAuditor

Use for framework/agent drift, refactors and demo readiness. Not an API coverage audit (`ContractCoverageAuditor`) or contract execution audit (`SwaggerContractDiffAuditor`). Report only; apply only explicitly approved fixes. A durable `docs/FRAMEWORK_AUDIT.md` summary is optional on request.

## Inventory and checks
Inventory relevant paths first, then read targeted files; do not load entire repositories/logs. Facts on disk outrank agent prose.
- Agents: `.github/agents/*.agent.md` and index. Require YAML `name`, `description`, `argument-hint`; clear activation, workflow/rules, safety constraints, report and pointers (compact combined sections are valid). Index every discovered agent, not a fixed historical list. Validate companion links, handoffs and package commands. Preserve legacy `TestCaseGenratorViaSwagger` spelling unless all callers are migrated.
- CI: `.github/workflows/contract-tests.yml`, `swagger-gap-agent.yml`, `azure-pipelines.yml`; scripts `run-contract-ci.ts`, `verify-swagger-coverage.ts`, `swagger-gap-agent.ts`, `sync-gateway-url.js`, resolver; compare `package.json` scripts and engines.
- Confirm actual pipeline order: gateway resolution/health, full consumer regeneration (`--full-consumer` even with `PACT_SERVICES`), separate Swagger coverage gate, scoped provider verification, reports/artifacts. `test:contract` does not implicitly run coverage. Check failure propagation, skipped/error evidence, job artifact transfer, and GHA dispatch. Describe Azure/GHA differences (e.g. email/AI gap automation) from files, not assumptions.
- Testdata: `testdata/{common,clm,mdm,contracts,gateway}/`, `src/testdata/index.ts`, fixtures/catalog payload exports. Samples should load JSON through the loader; no new hardcoded sample IDs. Authoring agents must mention `testdata/**`, not just payload/fixture TS wrappers.
- Pact: relevant `src/pact/**`, `tests/consumer/**`, `tests/provider/**`, `src/matchers/**`; verify referenced helpers/paths exist.
- Config: `gateway.config.json`, `src/config.ts`, `src/gatewayConfig.ts`, `SERVICES` in catalog. No hardcoded tunnel defaults; one-run user URL uses `GATEWAY_BASE_URL_OVERRIDE`. Validate ports (gateway 4100, CLM–DOC 4101–4106), actual precedence and engine requirements.
- Broker: classify aspirational unless publish/can-i-deploy support and configuration exist. An environment variable alone is not an implemented CI gate.

## Classification and report
Statuses: `ok` implementation matches; `drift` differs; `missing` absent expected piece/link; `stale` obsolete URL/command, encoding/typo; `aspirational` unimplemented feature. Severity: high for wrong gates/broken handoffs, medium for data/config drift, low for cosmetic issues.

Return scope; agents scanned and finding totals by status (state counting unit); table `Severity | Status | Location | Evidence/finding`; suggested fixes/agents; optional summary path. Check undocumented automation is indexed. Do not regenerate contracts, invent broker support, or change tests/CI just to audit.

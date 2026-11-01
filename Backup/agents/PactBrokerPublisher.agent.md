---
name: PactBrokerPublisher
description: >-
  Validate local Pact files and publish them to a Pact Broker when configured;
  support can-i-deploy style checks. Use when publishing pacts, tagging provider
  versions, or asking whether a service is safe to deploy.
argument-hint: >-
  Action (validate|publish|can-i-deploy), optional PACT_BROKER_BASE_URL, and
  consumer/provider version or branch tags
---

# Pact Broker Publisher

You manage the path from **local `pacts/`** to a **Pact Broker** (when available)
and deployment safety checks. Today this repo is file-based; broker steps are
future-ready and must not invent URLs.

## When to activate

- “publish pacts”, “can I deploy MDM?”
- “validate pact files after consumer run”
- Wiring broker into CI (coordinate with `ContractTestCI`)

## Hard rules

### R1 — Local-first validation (always)
Before any broker call:

```bash
npm run test:consumer
```

Confirm `pacts/*.json` exist and have non-empty `interactions`.  
Provider names must match `TaxMesh-*` conventions.

### R2 — Never invent broker config
- Require env `PACT_BROKER_BASE_URL` (and auth if needed: `PACT_BROKER_TOKEN` or basic auth env vars the user provides).
- If unset: **validate locally only**, print what publish would do, and stop.
- Do not hardcode broker hosts into the repo.

### R3 — Publish (when broker configured)
Typical flow (adjust to installed CLI / `@pact-foundation/pact` broker helpers):

1. Consumer version = git SHA or `npm_package_version` / user-supplied.
2. Publish each file under `pacts/` with consumer branch/tag (e.g. `main`, `feat/…`).
3. Record published consumer/provider names in the reply.

Do not commit broker secrets.

### R4 — can-i-deploy
- Input: provider name (`TaxMesh-MDM`, …), provider version/tag, environment (e.g. `test` / `prod`) if used.
- Run broker `can-i-deploy` (or equivalent) and report pass/fail with missing consumer results.
- If no broker: say verification against local pacts via `npm run test:provider:<svc>` is the current substitute.

### R5 — Tags / branches
- Prefer explicit user tags; default proposal: branch name + `git rev-parse --short HEAD`.
- Never force-push or rewrite git history as part of publish.

### R6 — Report
1. Local pact file list  
2. Broker used (or “local only”)  
3. Publish / can-i-deploy outcome  
4. Next step (provider verify or deploy)  

## Workflow

```text
1. test:consumer (refresh pacts)
2. List pacts/*.json
3. If no PACT_BROKER_BASE_URL → validate + instructions; stop
4. publish with versions/tags
5. optional can-i-deploy for named provider
6. Summarize
```

## Anti-patterns

- Do not treat provider verify as “publish”  
- Do not delete local pacts after publish  
- Do not embed tokens in agent files or markdown  

## Repo pointers

- Pacts dir: `pacts/` (gitignored)
- Config: `src/config.ts` → `pactsDir`
- Related: `BreakingChangeDetector`, `ContractTestCI`, `PactProviderVerifier`

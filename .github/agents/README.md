# Contract-testing agents

Cursor / Copilot custom agents for the TaxMesh Pact framework in this repo.
Each `.agent.md` is self-contained. Prefer the DiffAuditor → New / Updated flow for Swagger gaps.

| Agent | Role |
|-------|------|
| [SwaggerContractDiffAuditor](./SwaggerContractDiffAuditor.agent.md) | **Verify-only CI parity**: full-consumer regen → swagger coverage → scoped provider; writes `reports/swagger-contract-diff.json` |
| [ContractImplementNew](./ContractImplementNew.agent.md) | Implement **missing/new** OpenAPI ops (durable consumer source) |
| [ContractImplementUpdated](./ContractImplementUpdated.agent.md) | Fix **real** provider Body/Status mismatches on existing interactions |
| [ContractCoverageAuditor](./ContractCoverageAuditor.agent.md) | Read-only OpenAPI ↔ Pact coverage (`npm run test:swagger-coverage`) |
| [FrameworkAuditor](./FrameworkAuditor.agent.md) | Read-only agents / CI / scripts / `testdata/` drift |
| [TestCaseGenratorViaSwagger](./TestCaseGenratorViaSwagger.agent.md) | Legacy full Swagger sweep → generate gaps |
| [PactConsumerAuthor](./PactConsumerAuthor.agent.md) | Targeted consumer edge authoring |
| [NewServiceEdgeScaffolder](./NewServiceEdgeScaffolder.agent.md) | New CT edge end-to-end |
| [PactProviderVerifier](./PactProviderVerifier.agent.md) | Run / diagnose provider verification |
| [PactFailureDoctor](./PactFailureDoctor.agent.md) | Narrow BodyMismatch / red-run diagnosis |
| [BreakingChangeDetector](./BreakingChangeDetector.agent.md) | Breaking vs non-breaking API change analysis |
| [PactBrokerPublisher](./PactBrokerPublisher.agent.md) | Broker publish / can-i-deploy (when tooling exists) |
| [ContractTestCI](./ContractTestCI.agent.md) | Maintain GHA / Azure / local contract automation |

**Companions (not standalone “execute” agents):**

- [SwaggerContractDiffAuditor.azure.md](./SwaggerContractDiffAuditor.azure.md) — Azure build / log replay  
- [SwaggerContractDiffAuditor.regression.md](./SwaggerContractDiffAuditor.regression.md) — historical fixtures only  

**GHA automation (not a Cursor agent):** [`.github/workflows/swagger-gap-agent.yml`](../workflows/swagger-gap-agent.yml) + `npm run agent:swagger-gaps`.

## Ownership — which agent fixes what

| Symptom | Agent |
|---------|--------|
| `Missing OpenAPI ops` / no durable consumer (e.g. `GET /api/proxy/CLM/v2/status`) | **ContractImplementNew** |
| Real BodyMismatch / StatusMismatch (named endpoint + field, e.g. `legalName` vs `entityName`) | **ContractImplementUpdated** |
| CI email Provider **0/2**, Actual is `(OK)` console scraps, endpoint `—` | **Neither** — fix `scripts/run-contract-ci.ts` (`PROVIDER_RESULT_FILE` parse) |
| Coverage totals only, no implement | **ContractCoverageAuditor** / DiffAuditor **coverage only** |

## Suggested order

1. **SwaggerContractDiffAuditor** (`execute` / match CI) — report only  
2. **ContractImplementNew** and/or **ContractImplementUpdated** — only when you want fixes  
3. Re-run DiffAuditor (or provider-only + swagger-coverage) to confirm  
4. **PactFailureDoctor** if a real verifier failure remains unclear  

## Gateway & CI parity

- User URL → `GATEWAY_BASE_URL_OVERRIDE`; else [`gateway.config.json`](../../gateway.config.json).  
- DiffAuditor local sequence: clear `pacts/*.json` → `npm run test:contract:consumer-only -- --full-consumer` → swagger coverage → provider `--services=CLM,MDM` (or `PACT_SERVICES`).  
- `npm run test:contract` alone does **not** run the Swagger coverage gate.  
- Artifact: `reports/swagger-contract-diff.json` + `reports/_diff-provider-out.txt`.

## Remotes (agents on main)

This workspace often has two GitHub remotes:

| Remote | Repo | Typical use |
|--------|------|-------------|
| `azure` | `Avinash258/ContractTestingDemoProject` | Azure DevOps + public DemoProject |
| `origin` | `Avinash258/ContractTestingBussinessDemo` | Local `main` tracking |

Agents committed only on `origin/main` or feature branches (`fixBranch`, `fixV2`) **will not appear** on DemoProject [`main` commits](https://github.com/Avinash258/ContractTestingDemoProject/commits/main) until you merge/push:

```bash
git push azure main
# or: PR from fixBranch/fixV2 → main on ContractTestingDemoProject
```

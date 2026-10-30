# Contract-testing agents

Custom Cursor agents for the TaxMesh Pact framework in this repo.

| Agent | Role |
|-------|------|
| [FrameworkAuditor](./FrameworkAuditor.agent.md) | Read-only audit of agents, CI, scripts, and `testdata/` drift |
| [SwaggerContractDiffAuditor](./SwaggerContractDiffAuditor.agent.md) | **Execute** live Swagger vs pacts → **new / updated** API tables (default: notifications tunnel) |
| [ContractImplementNew](./ContractImplementNew.agent.md) | Implement Pact contracts **only for NEW** Swagger ops |
| [ContractImplementUpdated](./ContractImplementUpdated.agent.md) | Refresh Pact contracts **only for UPDATED** Swagger ops |
| [ContractCoverageAuditor](./ContractCoverageAuditor.agent.md) | Read-only coverage report vs OpenAPI (`npm run test:swagger-coverage[:ci]`) |
| [TestCaseGenratorViaSwagger](./TestCaseGenratorViaSwagger.agent.md) | Full Swagger sweep → generate missing contracts (legacy all-in-one) |
| [PactProviderVerifier](./PactProviderVerifier.agent.md) | Run/fix provider verification |
| [PactFailureDoctor](./PactFailureDoctor.agent.md) | Diagnose BodyMismatch / red Pact runs |
| [PactConsumerAuthor](./PactConsumerAuthor.agent.md) | Author a targeted consumer edge |
| [NewServiceEdgeScaffolder](./NewServiceEdgeScaffolder.agent.md) | Scaffold a new CT-XX edge end-to-end |
| [PactBrokerPublisher](./PactBrokerPublisher.agent.md) | Validate/publish pacts; can-i-deploy (**aspirational** until broker scripts exist) |
| [BreakingChangeDetector](./BreakingChangeDetector.agent.md) | Classify breaking vs non-breaking API changes |
| [ContractTestCI](./ContractTestCI.agent.md) | GitHub Actions / local contract-test pipeline |

**Automation (GHA, not a Cursor `.agent.md`):** `.github/workflows/swagger-gap-agent.yml` + `npm run agent:swagger-gaps` — LLM closes Swagger gaps on CI after `TaxMesh Contract Pipeline` fails the coverage gate.

Suggested order when unsure:

1. **SwaggerContractDiffAuditor** — against target `api-docs` (e.g. notifications) → new vs updated  
2. **ContractImplementNew** — close **new** ops  
3. **ContractImplementUpdated** — align **updated** ops  
4. **PactProviderVerifier** → **PactFailureDoctor** if red  
5. **FrameworkAuditor** / **ContractCoverageAuditor** — broader health / totals  

Legacy all-in-one: **TestCaseGenratorViaSwagger**.

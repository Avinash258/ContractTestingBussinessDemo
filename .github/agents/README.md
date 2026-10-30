# Contract-testing agents

Custom Cursor agents for the TaxMesh Pact framework in this repo.

| Agent | Role |
|-------|------|
| [FrameworkAuditor](./FrameworkAuditor.agent.md) | Read-only audit of agents, CI, scripts, and `testdata/` drift |
| [SwaggerContractDiffAuditor](./SwaggerContractDiffAuditor.agent.md) | **Fast verify-only**: Swagger vs written pacts (coverage + targeted probes); full `test:provider` only if you say “full verify” |
| [ContractImplementNew](./ContractImplementNew.agent.md) | Implement Pact contracts **only for NEW** Swagger ops |
| [ContractImplementUpdated](./ContractImplementUpdated.agent.md) | Fix **only Mismatch** endpoints from DiffAuditor report so contracts pass vs live |
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

1. **SwaggerContractDiffAuditor** — verify Swagger vs written contracts (report gaps/mismatches only)  
2. **ContractImplementNew** / **ContractImplementUpdated** — only if you explicitly want to write fixes  
3. **PactProviderVerifier** → **PactFailureDoctor** if provider verify is red  
5. **FrameworkAuditor** / **ContractCoverageAuditor** — broader health / totals  

Legacy all-in-one: **TestCaseGenratorViaSwagger**.

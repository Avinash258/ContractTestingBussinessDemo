# Contract-testing agents

Custom Cursor agents for the TaxMesh Pact framework in this repo.

| Agent | Role |
|-------|------|
| [FrameworkAuditor](./FrameworkAuditor.agent.md) | Read-only audit of agents, CI, scripts, and `testdata/` drift |
| [ContractCoverageAuditor](./ContractCoverageAuditor.agent.md) | Read-only coverage report vs OpenAPI (`npm run test:swagger-coverage[:ci]`) |
| [TestCaseGenratorViaSwagger](./TestCaseGenratorViaSwagger.agent.md) | Swagger → generate missing consumer/provider contracts |
| [PactProviderVerifier](./PactProviderVerifier.agent.md) | Run/fix provider verification |
| [PactFailureDoctor](./PactFailureDoctor.agent.md) | Diagnose BodyMismatch / red Pact runs |
| [PactConsumerAuthor](./PactConsumerAuthor.agent.md) | Author a targeted consumer edge |
| [NewServiceEdgeScaffolder](./NewServiceEdgeScaffolder.agent.md) | Scaffold a new CT-XX edge end-to-end |
| [PactBrokerPublisher](./PactBrokerPublisher.agent.md) | Validate/publish pacts; can-i-deploy (**aspirational** until broker scripts exist) |
| [BreakingChangeDetector](./BreakingChangeDetector.agent.md) | Classify breaking vs non-breaking API changes |
| [ContractTestCI](./ContractTestCI.agent.md) | GitHub Actions / local contract-test pipeline |

**Automation (GHA, not a Cursor `.agent.md`):** `.github/workflows/swagger-gap-agent.yml` + `npm run agent:swagger-gaps` — LLM closes Swagger gaps on CI after `TaxMesh Contract Pipeline` fails the coverage gate.

Suggested order when unsure:

1. **FrameworkAuditor** — if agents/CI/docs may be stale  
2. **ContractCoverageAuditor** — API coverage gaps  
3. **TestCaseGenratorViaSwagger** or **PactConsumerAuthor** — close gaps  
4. **PactProviderVerifier** → **PactFailureDoctor** if red  

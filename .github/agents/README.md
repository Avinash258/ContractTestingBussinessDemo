# Contract-testing agents

Custom Cursor agents for the TaxMesh Pact framework in this repo.

| Agent | Role |
|-------|------|
| [TestCaseGenratorViaSwagger](./TestCaseGenratorViaSwagger.agent.md) | Swagger → generate missing consumer/provider contracts |
| [ContractCoverageAuditor](./ContractCoverageAuditor.agent.md) | Read-only coverage report vs OpenAPI (`npm run test:swagger-coverage[:ci]` in pipeline) |
| [PactProviderVerifier](./PactProviderVerifier.agent.md) | Run/fix provider verification |
| [PactFailureDoctor](./PactFailureDoctor.agent.md) | Diagnose BodyMismatch / red Pact runs |
| [PactConsumerAuthor](./PactConsumerAuthor.agent.md) | Author a targeted consumer edge |
| [NewServiceEdgeScaffolder](./NewServiceEdgeScaffolder.agent.md) | Scaffold a new CT-XX edge end-to-end |
| [PactBrokerPublisher](./PactBrokerPublisher.agent.md) | Validate/publish pacts; can-i-deploy |
| [BreakingChangeDetector](./BreakingChangeDetector.agent.md) | Classify breaking vs non-breaking API changes |
| [ContractTestCI](./ContractTestCI.agent.md) | GitHub Actions / local contract-test pipeline |

Suggested order when unsure: **Auditor** → **Swagger generator** or **ConsumerAuthor** → **ProviderVerifier** → **FailureDoctor** if red.

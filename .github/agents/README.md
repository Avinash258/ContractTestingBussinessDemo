# Contract-testing agents

GitHub Copilot custom-agent definitions for the TaxMesh Pact framework. Each agent is self-contained; Azure retrieval and historical fixtures load only when needed. Existing names are preserved for caller compatibility.

| Agent | Use |
|---|---|
| [FrameworkAuditor](FrameworkAuditor.agent.md) | Read-only agent/CI/config/testdata drift audit |
| [ContractCoverageAuditor](ContractCoverageAuditor.agent.md) | Read-only OpenAPI coverage; no suite regeneration |
| [SwaggerContractDiffAuditor](SwaggerContractDiffAuditor.agent.md) | Fresh CI-parity coverage + scoped provider report; or Azure evidence |
| [TestCaseGenratorViaSwagger](TestCaseGenratorViaSwagger.agent.md) | Generate requested Swagger coverage gaps |
| [PactConsumerAuthor](PactConsumerAuthor.agent.md) | Targeted existing-edge consumer authoring |
| [NewServiceEdgeScaffolder](NewServiceEdgeScaffolder.agent.md) | New CT edge end-to-end |
| [PactProviderVerifier](PactProviderVerifier.agent.md) | Verify providers; fix only requested issues |
| [PactFailureDoctor](PactFailureDoctor.agent.md) | Narrow failure diagnosis and approved fixes |
| [BreakingChangeDetector](BreakingChangeDetector.agent.md) | API change compatibility analysis |
| [PactBrokerPublisher](PactBrokerPublisher.agent.md) | Local validation; Broker operations only with actual tooling/auth |
| [ContractTestCI](ContractTestCI.agent.md) | Maintain existing GHA/Azure/local automation |

## Routing and execution

- Framework consistency → FrameworkAuditor. Coverage only → ContractCoverageAuditor. Fresh coverage plus actual provider failures → SwaggerContractDiffAuditor.
- Generate/fix only on request. Existing interaction → PactConsumerAuthor/PactFailureDoctor; new edge → NewServiceEdgeScaffolder. Verify-only agents never implement changes.
- Auditor report handoff labels `ContractImplementNew` and `ContractImplementUpdated` are conceptual action categories, **not installed agents**. Route new missing-operation coverage to TestCaseGenratorViaSwagger/PactConsumerAuthor (new CT edge: NewServiceEdgeScaffolder); updates to PactFailureDoctor/PactConsumerAuthor after intent review.
- User gateway URL takes precedence via `GATEWAY_BASE_URL_OVERRIDE`; otherwise `gateway.config.json`. No agent pins a temporary Cloudflare hostname. Use package engine-compatible Node (current 22.x CI; minimum 22.18.0 on that line).
- CI parity: full-consumer regeneration → separate Swagger gate → scoped provider verification. Default provider scope CLM,MDM; all-provider proof requires explicit all-seven verification. `test:contract` alone does **not** run Swagger coverage.
- GHA authoring automation is separate: `.github/workflows/swagger-gap-agent.yml` + `npm run agent:swagger-gaps`; it is not the verify-only auditor.

## Azure and reports

[Azure companion](SwaggerContractDiffAuditor.azure.md): load for uploaded CI logs, exact build URL, or `azure latest`. Automatic reads require configured authenticated Azure access, organization/project/definition and branch; never put credentials in prompts. Pin one completed build; pipeline status alone is not a contract verdict. No triggering/editing pipelines.

[Historical fixture](SwaggerContractDiffAuditor.regression.md): explicit regression requests only, never current-run authority.

Auditor outputs `reports/swagger-contract-diff.json`, coverage and exact interaction failure rows, plus full provider output at `reports/_diff-provider-out.txt`. Missing evidence stays INCOMPLETE, not zero or PASS. Changes here do not implement missing Broker tooling or alter pipeline behavior.

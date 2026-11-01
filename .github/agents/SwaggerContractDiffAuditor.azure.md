# Azure Pipeline evidence — CI-log mode only

Read-only companion to `SwaggerContractDiffAuditor.agent.md`; core counting/report rules apply. Never run or repair pipelines.

## Inputs and authentication

- **Build URL/ID:** audit that exact build; obtain project/definition from its metadata.
- **azure latest:** require organization URL, project, definition ID from request/existing config. Resolve branch from request or configured repository default; ask if ambiguous. Never assume `main` or choose another pipeline.
- **Uploaded/pasted logs:** no connection needed. Prefer accompanying same-run JSON artifacts; record supplied build/job/attempt identifiers and leave absent metadata unknown.

For retrieval, use an authenticated Azure DevOps integration or REST with an externally configured credential. The build-log API documents OAuth scope `vso.build`; PAT authentication is supported. Read secrets from the environment's secret mechanism (e.g. `AZURE_DEVOPS_PAT`), never chat/source/command arguments/reports. Do not request a PAT in chat. Without access, request exported logs and the build URL; never claim retrieval. [1](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds/get-build-log?view=azure-devops-rest-7.1)

Examples use Azure DevOps Services REST 7.1; use the organization's supported version. Define `B={organizationUrl}/{project}/_apis/build/builds`; URL-encode path/query values. All requests below are GET with `api-version=7.1`.

## Select and pin a run

Explicit build: `B/{buildId}`. Latest completed match:

```text
B?definitions={definitionId}&branchName={branch}&statusFilter=completed&queryOrder=finishTimeDescending&$top=1&api-version=7.1
```

The list API supports these filters and completion-time ordering. [2](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds/list?view=azure-devops-rest-7.1) Freeze returned `id`; every artifact/log must belong to that build. No match → report none. Canceled latest → INCOMPLETE. Never silently substitute an older green/failed build. “Latest failed” requires explicit `resultFilter=failed` and that label. An in-progress snapshot is incomplete, not a completed latest result; do not poll indefinitely.

Record `id`, `buildNumber`, web URL, `definition.id`, `sourceBranch`, `sourceVersion`, `finishTime`, `status`, `result`. Azure result is pipeline status, not the contract verdict.

## Retrieve minimal, complete evidence

1. **Timeline:** `B/{buildId}/timeline`. Identify consumer, swagger-coverage, and provider tasks by actual names/commands, with job context, `log.id`, state/result, and retry attempts—not assumed task names. [3](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/timeline/get?view=azure-devops-rest-7.1)
2. **Artifacts:** list `B/{buildId}/artifacts`; discover names, then fetch relevant coverage/verifier JSON using `B/{buildId}/artifacts?artifactName={name}`. Its `resource.downloadUrl` supplies the download. Skip unrelated artifacts/pacts and repository downloads. [4](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/artifacts/list?view=azure-devops-rest-7.1) [5](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/artifacts/get-artifact?view=azure-devops-rest-7.1)
3. **Logs:** fetch `B/{buildId}/logs/{logId}` in full. No `startLine`/`endLine`, tail-only previews, or last-line verdicts. Save complete provider output to `reports/_diff-provider-out.txt`, other evidence under `reports/azure/{buildId}/`. Preserve job/attempt boundaries; never count retries twice. [1](https://learn.microsoft.com/en-us/rest/api/azure/devops/build/builds/get-build-log?view=azure-devops-rest-7.1)

Use bounded timeouts/retries for transient transport errors; fetch independent evidence concurrently where supported. Parse files locally, loading only compact counts/failure rows into context. Access/permission failures are blockers, not zero gaps. A pinned completed build's downloaded evidence may be reused with metadata; `azure latest` resolves the latest match again.

Never print authorization headers, PATs, or signed URLs. Follow artifact download URLs only from authenticated responses for the configured Azure host; never forward credentials to another origin. Redact accidental secrets in excerpts.

## CI verdict checks

- Confirm the consumer cleared/generated pacts with `--full-consumer`, not a scoped subset. Verify logged commands and relevant pipeline config; a job name alone is insufficient.
- Confirm coverage completed; obtain counts/missing operations from this build.
- Confirm every requested provider ran. Prefer same-build verifier JSON, otherwise complete provider failure blocks/summaries. Count interactions once, not endpoints, lines, or retries.
- Never fill CI gaps with local pacts, another build, email, or golden counts. If local confirmation is also requested, report it separately and explain differences.
- PASS requires confirmed full-consumer regeneration, completed coverage and requested provider scope, and `C=M=0`. Missing rows, skipped/unknown stages, canceled runs, or infrastructure failures prevent a complete contract assessment: use INCOMPLETE and identify missing evidence. Preserve known CI counts but do not invent failure fields.

Set core JSON `source.kind=azure-build` for REST or `azure-upload` for supplied files; populate build metadata. Set `pactRegeneration=full-consumer` only when verified. The reply identifies build/branch/commit/finish time and says regeneration occurred **in CI**, not locally. Keep the standard banner/handoffs.

For exported logs, request complete consumer, coverage, and provider tasks plus available JSON artifacts and build URL. Apply identical checks. A FAIL email alone supports replay, not a raw-log audit claim.

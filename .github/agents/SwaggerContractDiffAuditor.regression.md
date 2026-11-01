# SwaggerContractDiffAuditor — optional #529 regression fixture

**Not a runtime instruction or live result authority.** Use only to test the auditor against pipeline #529 / the 2026-10-30 notifications-host regeneration, with its original interaction set and data.

## Preconditions

- Committed consumer sources still expect `legalName`; live MDM returns `entityName`.
- OpenAPI operation `clm_v2_status` has no durable consumer.
- Gateway resolves to that historical notifications host; provider scope is CLM,MDM.
- Clear pacts and regenerate using `--full-consumer`, including the ACC→MDM pact, before verification.

## Expected result

```text
Overall FAIL
Consumer swagger gaps: 1 · Provider verification gaps: 2 · Missing OpenAPI ops: 1
Gaps total: 3
```

| ops | covered | missing/new | mismatch/update | deferred |
|---|---|---|---|---|
| 108 | 107 | 1 | 2 | 0 |

Provider score: **34/36**; CLM **13/13 PASS**, TaxMesh-MDM **21/23 FAIL (2)**. Coverage mismatch 0 before merging does not reduce the effective provider count.

### missingOperations — one row

- Method/path: `GET /api/proxy/CLM/v2/status`
- Operation ID: `clm_v2_status`
- Reason: no consumer/pact contract covers this OpenAPI operation.

### providerFailures — two rows

Both rows: service `TaxMesh-MDM`, method `GET`, pact file `TaxMesh-ACC-TaxMesh-MDM.json`; expected keys include `legalName`, actual keys include `entityName`.

| Provider-relative path | Full URL | Exact interaction |
|---|---|---|
| `/contracts/ct-01/entities` | `{gateway}/api/proxy/MDM/contracts/ct-01/entities` | `an ACC request for CT-01 entities` |
| `/downstream/ACC` | `{gateway}/api/proxy/MDM/downstream/ACC` | `an ACC request for MDM downstream payloads to ACC` |

Verifier evidence: actual map missing `legalName`. Required handoffs:

- ContractImplementNew: `GET /api/proxy/CLM/v2/status`.
- ContractImplementUpdated: `legalName → entityName` for both interactions in committed matchers/testdata, not just generated pacts.

## Auditor assertions

1. After the specified full regeneration, this fixture yields `C=1`, `M=2`, `T=3`, with two complete failure rows. Reporting provider gaps 0/Gaps 1 while the specified `legalName` expectations remain is a stale-pact/skipped-regeneration audit bug, not PASS.
2. A services-scoped consumer run is not a valid substitute for full-consumer regeneration.
3. Do not invent additional gaps such as CLM `/consume/CT-00`.
4. Do not classify `/v2/*` HTTP 502 itself as missing coverage.
5. Provider log truncation must not hide either failure.

Changed source contracts, host data, scope, or interaction counts require a fresh audit; never force this historical result onto a different run.

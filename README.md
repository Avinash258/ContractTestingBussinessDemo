# TaxMesh Pact Framework (TypeScript) — full Swagger coverage

Consumer-driven contracts for TaxMesh aligned with  
`https://…trycloudflare.com/api-docs` / local gateway `:4100`.

## Coverage

| Area | Status |
|------|--------|
| **CT-00…CT-17** produce paths | Covered |
| Peer `/downstream/{peer}` + `/upstream/{peer}` | Covered |
| Gateway `getFlowDownstreamPair` / upstream pairs | Covered |
| Gateway `/api/flow`, `/api/flow/edges`, health, architecture, contracts | Covered |
| Per-service discovery (`/health`, `/contracts`, `/flow`, `/pipeline`, consume down/up) | Covered |
| Filing **GET** (`/api/filing`, datasets, gates, jobs, form1065, validate) | Covered |
| Filing **POST** (upload/run/calculate/allocate/reset) | Not in Pact (mutation/orchestration; use E2E) |

### Pact pairs

| Provider | Port | Consumers (examples) |
|----------|------|----------------------|
| `TaxMesh-CLM` | 4101 | `TaxMesh-MDM` |
| `TaxMesh-MDM` | 4102 | ACC, TAX, ALC, DOC |
| `TaxMesh-ACC` | 4103 | MDM, TAX, ALC |
| `TaxMesh-TAX` | 4104 | MDM, ACC, ALC, DOC |
| `TaxMesh-ALC` | 4105 | MDM, TAX, DOC |
| `TaxMesh-DOC` | 4106 | MDM, TAX, ALC |
| `TaxMesh-Gateway` | 4100 | `TaxMesh-Client` |

## Run

```bash
# TaxMesh stack must be up
cd ../ContratTestingBussinessDemo && npm start

cd ../ContractTestingDemoProject
npm install
npm run test:consumer     # 117 interactions → ./pacts
npm run test:provider     # verify all 7 providers
# or
npm run test:contract
```

Override bases: `URL_CLM`, `URL_MDM`, … `GATEWAY_BASE_URL` / `TAXMESH_BASE_URL`.

## Azure DevOps pipeline (EY_Demo-style gate + HTML report)

Pipeline: [`azure-pipelines.yml`](azure-pipelines.yml)  
Pattern matches `InnoVisionDA/EY_Demo` contract gate: **Consumer → Provider → HTML/email report**.

### Stages

1. **Consumer** — `npm run test:contract:consumer-only` → **Swagger coverage gate** (`openapi.json` ↔ Pact) → publish `pact-files` + `pact-reports`
2. **Provider** — restore pacts → gateway health → `npm run test:contract:provider-only` → email report → publish `pact-provider-report`

Swagger coverage (same rules as the Cursor `ContractCoverageAuditor` / `TestCaseGenratorViaSwagger` agents) fails the pipeline when live OpenAPI has unexpected uncovered ops:

```bash
npm run test:swagger-coverage          # report only → reports/swagger-coverage.json
npm run test:swagger-coverage:ci       # --fail-on-gap + refresh docs/SWAGGER_GAP_COVERAGE.md
```

Reports land in `reports/pact-report.html` and `reports/latest.json` (service map, CT matrix, failures).

### Create / update pipeline

1. Azure DevOps → **ContractTesting** → Pipelines → New / Edit  
2. GitHub repo `Avinash258/ContractTestingDemoProject`  
3. Existing YAML → `/azure-pipelines.yml` on `main`  
4. Set variables:

| Variable | Secret? | Purpose |
|----------|---------|---------|
| `GATEWAY_BASE_URL` | no | TaxMesh gateway (required for provider job) |
| `URL_CLM` … `URL_DOC` | no | Direct service bases if not on same host |
| `SMTP_USER` | no | Default in YAML: `avinashazureemail@gmail.com` (override OK) |
| `SMTP_PASS` | **yes** | Gmail **App Password** (16 chars) — never commit; pipeline secret only |
| `REPORT_EMAIL_TO` | no | Defaults to Avinash, Ananthi, Satyam (not Sandeep) |

Email uses **Gmail SMTP** (`smtp.gmail.com:587`). Create app password: https://myaccount.google.com/apppasswords

### Local report run

```bash
npm run test:contract              # consumer + provider + HTML
npm run test:contract:consumer-only
npm run send-report                # needs SMTP_* env
npm run report:refresh             # rebuild Excel + dashboard from reports/pact-report.json
```

Open the interactive UI at [`dashboard/index.html`](dashboard/index.html) (uses `dashboard/data/latest.json` / `latest.js`).

## Report colours & regeneration

Excel (`reports/TaxMesh-Contract-Report.xlsx`) and the dashboard share one status palette:

| Status | Fill | Font | Meaning |
|--------|------|------|---------|
| passed / covered / healthy | `#DCFCE7` | `#166534` | OK |
| failed / error | `#FEE2E2` | `#991B1B` | Broken contract |
| skipped / unknown | `#FEF3C7` | `#92400E` | Not run / unclear |
| deferred | `#E0E7FF` | `#3730A3` | Intentionally out of gate |
| partial | `#FFEDD5` | `#9A3412` | Path exercised but incomplete (e.g. upload 400-only) |

Duration colour-scales: green (fast) → yellow → red (slow). Service chips (CLM/MDM/ACC/TAX/ALC/DOC/Gateway/Client) use fixed pastels on CT Matrix / Service Health.

### Add a new status colour

1. Add the status to `PALETTE` in [`src/reporting/excelReport.ts`](src/reporting/excelReport.ts).
2. Mirror the same fill/font in `dashboard/index.html` (`.badge.<status>` + SpreadsheetML fallback styles).
3. Include the status in Excel conditional-format rules (`addStatusConditionalRules`) and the Legend sheet.

### Regenerate the report

```bash
npm run test:contract              # full run → JSON + Excel + dashboard data
# or, without re-running tests:
npm run report:refresh             # from reports/pact-report.json (+ optional reports/swagger-coverage.json)
```

Coverage rows come from `reports/swagger-coverage.json` (via `npm run test:swagger-coverage`). Upload endpoints `/api/filing/upload/{acc|clm|mdm}` are reported as **partial** when only the 400 error path is contracted.
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

## Azure DevOps pipeline

Pipeline YAML: [`azure-pipelines.yml`](azure-pipelines.yml)  
Org/project: `InnoVisionDA` / `ContractTesting` · GitHub repo `Avinash258/ContractTestingDemoProject` · branch `main`

### Create the pipeline in Azure DevOps

1. Open **Pipelines** → **New pipeline** (or finish the Node.js CI designer you started).
2. Select **GitHub** → `Avinash258/ContractTestingDemoProject`.
3. Choose **Existing Azure Pipelines YAML file** → path `/azure-pipelines.yml` → branch `main`.
4. **Save and run**.

Default gate: **Pact consumer tests** (generates `pacts` artifact).  
Provider verification is **off** on Microsoft-hosted agents (no TaxMesh on `localhost:410x`).

### Optional: enable provider verification

Pipeline → **Edit** → **Variables**:

| Variable | Example | Purpose |
|----------|---------|---------|
| `RUN_PROVIDER_VERIFY` | `true` | Turn on provider stage |
| `GATEWAY_BASE_URL` | TaxMesh gateway URL | Health check + gateway verify |
| `URL_CLM` … `URL_DOC` | Direct service bases | Required for service provider verify |

Use a **self-hosted agent** that can reach TaxMesh (or run the demo stack on that agent). Do not put PATs in YAML; use Azure DevOps secret variables / service connections only.

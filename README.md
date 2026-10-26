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

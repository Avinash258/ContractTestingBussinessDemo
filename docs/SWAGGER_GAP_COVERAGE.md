# Swagger ? Pact coverage gap analysis

Source: `https://notifications-ads-cnet-room.trycloudflare.com/openapi.json`
Date: 2026-10-30

## Summary

| Swagger ops | Covered | Partial | Missing | Deferred |
|-------------|---------|---------|---------|----------|
| 107 | 56 | 15 | 33 | 3 |

## Gap Details

### Covered
- **CT-00 to CT-17**: All producer paths `/api/proxy/{SVC}/contracts/ct-XX/...` are covered.
- **Peer Flows (CT-05 to CT-17)**: Downstream/Upstream peer paths for these are covered.
- **Gateway Flow/Contracts**: `/api/flow`, `/api/flow/downstream/{from}/{to}`, `/api/contracts/{id}` are covered.
- **Filing GETs**: `/api/filing`, `/api/filing/form1065`, `/api/filing/gates`, `/api/filing/jobs`, `/api/filing/datasets` are covered.
- **Filing POSTs**: `/api/filing/reset`, `/api/filing/run-all`, `/api/filing/run/{stepId}`, `/api/filing/tax/calculate`, `/api/filing/alc/allocate` are covered.
- **Consume by ID**: `/api/proxy/{SVC}/consume/{contractId}` is covered.

### Partial
- **Peer Flows (CT-00 to CT-04)**: `GET /api/proxy/{SVC}/downstream/{peerId}` and `upstream` are missing for the first 5 contracts.
- **Uploads**: `POST /api/filing/upload/{clm|mdm|acc}`: Only 400 (missing file) is covered. 200 (Success) is deferred.

### Missing (P2/P3/P4)
- **Gateway**: `GET /api/health`, `GET /api/architecture`, `GET /api/contracts` (List), `GET /api/flow/edges`.
- **Filing Validation**: `GET /api/filing/validate/tax`, `GET /api/filing/validate/alc`.
- **Service Discovery (All Services)**:
  - `GET /api/proxy/{SVC}/health`
  - `GET /api/proxy/{SVC}/contracts`
  - `GET /api/proxy/{SVC}/flow`
  - `GET /api/proxy/{SVC}/contracts/downstream`
  - `GET /api/proxy/{SVC}/contracts/upstream`
  - `GET /api/proxy/{SVC}/pipeline`
  - `GET /api/proxy/{SVC}/consume/downstream`
  - `GET /api/proxy/{SVC}/consume/upstream`
- **CLM v2 API**: `GET /api/proxy/CLM/v2/engagement`, `PATCH /api/proxy/CLM/v2/engagement`, `GET /api/proxy/CLM/v2/status`.
- **MDM v2 API**: `GET /api/proxy/MDM/v2/entity`, `GET /api/proxy/MDM/v2/partners`, `GET /api/proxy/MDM/v2/ownership`, `GET /api/proxy/MDM/v2/status`.

### Deferred
- `POST /api/filing/upload/clm` (200 OK) - Requires multipart binary .xlsx
- `POST /api/filing/upload/mdm` (200 OK) - Requires multipart binary .xlsx
- `POST /api/filing/upload/acc` (200 OK) - Requires multipart binary .xlsx

## Equivalent coverage note

Service Pact paths `/health`, `/contracts/ct-*`, `/downstream/{peer}` equal Swagger `/api/proxy/{SVC}/�` (gateway is a transparent proxy).

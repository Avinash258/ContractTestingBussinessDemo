# Swagger ? Pact coverage gap analysis

Source: `https://notifications-ads-cnet-room.trycloudflare.com/openapi.json`
Date: 2026-10-28

## Summary

| Swagger ops | Covered | Partial | Missing | Deferred |
|-------------|---------|---------|---------|----------|
| 85 | 48 | 12 | 22 | 3 |

## Gap Details

### Missing (Critical)
- `GET /api/health` (Gateway)
- `GET /api/architecture` (Gateway)
- `GET /api/contracts` (List)
- `GET /api/flow` (Catalog)
- `GET /api/flow/edges`
- `GET /api/flow/downstream/{from}/{to}`
- `GET /api/flow/upstream/{from}/{to}`
- `GET /api/filing` (Snapshot)
- `GET /api/filing/form1065`
- `GET /api/filing/gates`
- `GET /api/filing/jobs`
- `GET /api/filing/datasets`
- `GET /api/filing/validate/tax`
- `GET /api/filing/validate/alc`
- `GET /api/proxy/{SVC}/health` (all services)
- `GET /api/proxy/{SVC}/contracts` (all services)
- `GET /api/proxy/{SVC}/flow` (all services)
- `GET /api/proxy/{SVC}/contracts/downstream` (all services)
- `GET /api/proxy/{SVC}/contracts/upstream` (all services)
- `GET /api/proxy/{SVC}/pipeline` (all services)
- `GET /api/proxy/{SVC}/consume/downstream` (all services)
- `GET /api/proxy/{SVC}/consume/upstream` (all services)

### Partial
- `POST /api/filing/upload/{clm|mdm|acc}`: Only 400 (missing file) is covered. 200 (Success) is deferred.
- `GET /api/proxy/{SVC}/downstream/{peerId}`: Covered via CT-XX peer flow paths for CT-05-17, but not for CT-00-04.
- `GET /api/proxy/{SVC}/upstream/{peerId}`: Covered via CT-XX peer flow paths for CT-05-17.

### Deferred
- `POST /api/filing/upload/clm` (200 OK) - Requires multipart binary .xlsx
- `POST /api/filing/upload/mdm` (200 OK) - Requires multipart binary .xlsx
- `POST /api/filing/upload/acc` (200 OK) - Requires multipart binary .xlsx

## Equivalent coverage note

Service Pact paths `/health`, `/contracts/ct-*`, `/downstream/{peer}` equal Swagger `/api/proxy/{SVC}/�` (gateway is a transparent proxy).

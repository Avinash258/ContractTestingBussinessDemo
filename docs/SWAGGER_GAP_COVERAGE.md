# Swagger ↔ Pact coverage gap analysis

Source: `https://pubmed-physiology-speaks-bibliographic.trycloudflare.com/openapi.json`  
Date: 2026-10-26

## Summary

| Swagger ops | Previously covered | Gap filled this pass | Still open |
|-------------|--------------------|----------------------|------------|
| 107 | ~majority of GET CT/flow/discovery | `contracts/{id}`, `consume/{contractId}`, filing POSTs | Multipart upload **success** path (needs real `.xlsx`) |

## Gaps addressed

| Swagger operation | Pact addition |
|-------------------|---------------|
| `GET /api/contracts/{id}` | Gateway consumer — all CT-00…CT-17 |
| `GET /api/proxy/{svc}/consume/{contractId}` | Per consumed CT on each consumer service |
| `POST /api/filing/reset` | Gateway mutation |
| `POST /api/filing/run-all` | Gateway mutation |
| `POST /api/filing/run/{stepId}` | Gateway — sample steps `cem`, `tax` |
| `POST /api/filing/tax/calculate` | Gateway mutation |
| `POST /api/filing/alc/allocate` | Gateway mutation |
| `POST /api/filing/upload/{clm\|mdm\|acc}` | Gateway — **400** without multipart file (error contract) |

## Still not fully covered

| Operation | Reason |
|-----------|--------|
| `POST /api/filing/upload/*` **200** success | Requires real Excel fixtures + multipart; add E2E or Pact with binary fixtures later |
| All `run/{stepId}` step values | Sampled `cem` + `tax`; other steps same shape |

## Equivalent coverage note

Service Pact paths `/health`, `/contracts/ct-*`, `/downstream/{peer}` equal Swagger `/api/proxy/{SVC}/…` (gateway is a transparent proxy).

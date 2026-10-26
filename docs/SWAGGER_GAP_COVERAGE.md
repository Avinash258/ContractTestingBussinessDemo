# Swagger ↔ Pact coverage gap analysis

Source: `https://pubmed-physiology-speaks-bibliographic.trycloudflare.com/openapi.json`
Date: 2026-10-26

## Summary

| Swagger ops | Covered | Partial | Missing | Deferred |
|-------------|---------|---------|---------|----------|
| 107 | 104 | 0 | 0 | 3 |

## Deferred

| Method | Path | Note |
|--------|------|------|
| GET | `/api/proxy/CLM/upstream/{peerId}` | CLM has no upstream CT peer in catalog — empty peer surface |
| GET | `/api/proxy/DOC/downstream/{peerId}` | DOC has no downstream CT peer in catalog — empty peer surface |
| GET | `/api/proxy/MDM/upstream/{peerId}` | MDM has no upstream CT peer in catalog — empty peer surface |

## Equivalent coverage note

Service Pact paths `/health`, `/contracts/ct-*`, `/downstream/{peer}` equal Swagger `/api/proxy/{SVC}/…` (gateway is a transparent proxy).

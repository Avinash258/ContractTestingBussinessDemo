# Swagger ? Pact coverage gap analysis

Source: `https://notifications-ads-cnet-room.trycloudflare.com/openapi.json`
Date: 2026-10-30

## Summary

| Swagger ops | Covered | Partial | Missing | Mismatch | Deferred |
|-------------|---------|---------|---------|----------|----------|
| 108 | 105 | 0 | 1 | 2 | 0 |

## Missing

| Method | Path | Note |
|--------|------|------|
| GET | `/api/proxy/CLM/v2/status` | Missing/new: pact-only orphan (no consumer test) - CI drops this |

## Mismatch

| Method | Path | Note |
|--------|------|------|
| GET | `/api/proxy/MDM/contracts/ct-01/entities` | Update/mismatch: Actual map is missing the following keys: legalName |
| GET | `/api/proxy/MDM/downstream/{peerId}` | Update/mismatch: Actual map is missing the following keys: legalName |

## Equivalent coverage note

Service Pact paths `/health`, `/contracts/ct-*`, `/downstream/{peer}` equal Swagger `/api/proxy/{SVC}/�` (gateway is a transparent proxy).

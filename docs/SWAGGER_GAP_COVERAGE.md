# Swagger ? Pact coverage gap analysis

Source: `https://notifications-ads-cnet-room.trycloudflare.com/openapi.json`
Date: 2026-10-30

## Summary

| Swagger ops | Covered | Partial | Missing | Mismatch | Deferred |
|-------------|---------|---------|---------|----------|----------|
| 108 | 107 | 0 | 1 | 1 | 0 |

## Missing

| Method | Path | Note |
|--------|------|------|
| GET | `/api/proxy/CLM/v2/status` | New/uncovered API; stub pact exists - also counted in mismatch |

## Mismatch

| Method | Path | Note |
|--------|------|------|
| GET | `/api/proxy/CLM/v2/status` | Stub/wrong-shape written pact (e.g. { isReady }) - not a correct contract vs live/OpenAPI |

## Equivalent coverage note

Service Pact paths `/health`, `/contracts/ct-*`, `/downstream/{peer}` equal Swagger `/api/proxy/{SVC}/�` (gateway is a transparent proxy).

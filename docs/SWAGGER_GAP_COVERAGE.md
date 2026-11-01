# Swagger ? Pact coverage gap analysis

Source: `https://notifications-ads-cnet-room.trycloudflare.com/openapi.json`
Date: 2026-10-31

## Summary

| Swagger ops | Covered | Partial | Missing | Mismatch | Deferred |
|-------------|---------|---------|---------|----------|----------|
| 108 | 108 | 0 | 0 | 3 | 0 |

## Mismatch

| Method | Path | Note |
|--------|------|------|
| GET | `/` | Update/mismatch (no exact OpenAPI row): code [1m200[0m ([32mOK[0m)
      includes headers
        "[1mContent-Type[0m" with value "[1mapplication/json[0m" ([32mOK[0m)
      has a matching body ([32mOK[0m)

  a client request for getFlowUpstreamPair DOC/MDM (8ms loading, 786ms verification)
     Given upstr… |
| GET | `/api/proxy/CLM/` | Update/mismatch (no exact OpenAPI row): returns a response which
      has status code [1m200[0m ([32mOK[0m)
      includes headers
        "[1mContent-Type[0m" with value "[1mapplication/json[0m" ([32mOK[0m)
      has a matching body ([32mOK[0m)

  an MDM health check against CLM (5ms loading, 294ms verif… |
| GET | `/api/proxy/MDM/` | Update/mismatch (no exact OpenAPI row): includes headers
        "[1mContent-Type[0m" with value "[1mapplication/json[0m" ([32mOK[0m)
      has a matching body ([32mOK[0m)

  a TAX request for MDM downstream payloads to TAX (0s loading, 288ms verification)
     Given MDM has downstream contracts to TAX
    ret… |

## Equivalent coverage note

Service Pact paths `/health`, `/contracts/ct-*`, `/downstream/{peer}` equal Swagger `/api/proxy/{SVC}/�` (gateway is a transparent proxy).

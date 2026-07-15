# vesting-app-canton

A **fully-mediated** web app for the `vesting` Daml package (in [`../`](..)):

```
React (browser)  ──►  backend REST API  ──►  Canton JSON Ledger API (v2)  ──►  participant
   frontend/            backend/
```

The browser only ever talks to the backend. All ledger concerns — template ids,
party tokens, ledger offsets, JSON encodings for `RelTime`/`Date`/`Decimal` — live
in the backend. This is the pattern Canton's own frontend guidance recommends.

## What it does

Drives the propose → accept → release flow from
[`../daml/VestingAgreement.daml`](../daml/VestingAgreement.daml):

- **Company** creates a `VestingProposal` (start date, cliff, tranches).
- **Employee** `Accept`s (→ `VestingAgreement`) or `Reject`s.
- **Company** `ReleaseTranche`s once vested → mints a `CantonCoin` to the employee.
- View proposals / agreements / coins from any party's perspective.

## Layout

| Path | What |
| --- | --- |
| `backend/src/ledger.ts` | The **only** module that calls the ledger. Submit + query wrappers. |
| `backend/src/daml.ts` | DTO ↔ Daml mapping. Payload types + template ids come from the generated bindings. |
| `backend/src/routes.ts` | REST endpoints (`/api/...`) — the mediation layer. |
| `backend/src/token.ts` | OAuth2 client-credentials token (only when auth is enabled). |
| `backend/daml-ts/` | **Generated** TypeScript bindings (`dpm codegen-js`). Git-ignored; regenerate with `npm run gen:daml`. |
| `frontend/src/api.ts` | Typed client over the backend REST API. |
| `frontend/src/App.tsx` | The UI. |

### Typed from the DAR

`backend/src/daml.ts` no longer hand-writes the contract payloads. It imports them
from `@daml.js/vesting-1.0.0` — the output of `dpm codegen-js` — so template ids
(`VA.VestingProposal.templateId`), field shapes, and scalar encodings
(`Party`/`Date`/`Numeric`/`Int` are all strings; `RelTime` is `{ microseconds: string }`)
come straight from the compiled Daml. Change a template's fields, rebuild the DAR,
`npm run gen:daml`, and `daml.ts` stops compiling until it's updated to match.

## Prerequisites

1. **A running Canton participant exposing the JSON Ledger API (v2).**
   - dpm sandbox: JSON Ledger API on `http://localhost:6864`.
   - Classic local sandbox: `daml sandbox` / Canton — JSON API typically on `http://localhost:7575`.
   - cn-quickstart LocalNet: AppUser validator on `http://localhost:2975`.
2. **The DAR built and uploaded to that participant.** Build it from the parent project first
   (`daml build` also works if you have the classic SDK on PATH):
   ```bash
   cd ..            # the intro-parties Daml project
   dpm build        # -> .daml/dist/vesting-1.0.0.dar
   ```
   Then upload it (unauthenticated sandbox shown; add `-H "Authorization: Bearer $TOKEN"` if auth is on):
   ```bash
   curl -X POST http://localhost:6864/v2/packages \
     -H "Content-Type: application/octet-stream" \
     --data-binary @../.daml/dist/vesting-1.0.0.dar
   ```

## Run

**Backend**

```bash
cd backend
cp .env.example .env      # then edit LEDGER_JSON_API_URL / auth to match your node
npm run gen:daml          # generate TS bindings from ../../.daml/dist/vesting-1.0.0.dar
npm install
npm run dev               # http://localhost:3001
```

**Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173  (proxies /api -> :3001)
```

Open http://localhost:5173. Allocate a couple of parties (e.g. `Company`,
`Employee`), create a proposal, accept it, advance ledger time, and release tranches.

> **Vesting is time-gated.** `ReleaseTranche` fails until the cliff and the
> tranche's offset have elapsed in *ledger* time. On a fresh sandbox, either set
> a `startDate`/offsets already in the past, or advance the sandbox clock, or the
> release calls will (correctly) fail with `cliff has not been reached yet`.

## Configuration (`backend/.env`)

| Var | Meaning |
| --- | --- |
| `LEDGER_JSON_API_URL` | Base URL of the participant's JSON Ledger API. |
| `LEDGER_USER_ID` | User/application id put on submitted commands. |
| `PACKAGE_REF` | Package-name ref for template ids — `#vesting` (from `daml.yaml`). |
| `AUTH_ENABLED` | `false` for an open sandbox; `true` to attach an OAuth2 bearer token. |
| `OAUTH_*` | Client-credentials settings used when `AUTH_ENABLED=true`. |

## Notes on the JSON Ledger API (v2)

The exact request/response envelopes evolve across Canton point releases. This
scaffold targets v2 and reads defensively (see the shape-tolerant parsing in
`ledger.ts`: `createdEvents`, `queryActive`). If a call fails, check your node's
live spec at `<LEDGER_JSON_API_URL>/docs/openapi` and adjust `ledger.ts` — the
REST DTOs the frontend depends on won't need to change.

Scalar encodings used:

| Daml type | JSON |
| --- | --- |
| `Party` | string (`"Alice::<hash>"`) |
| `Date` | `"YYYY-MM-DD"` |
| `Decimal` | string (`"100.0"`) |
| `Int64` | number |
| `RelTime` | `{ "microseconds": <number> }` |

## Going to production

- Put the OAuth flow for **real end users** (OIDC login) in front of the backend,
  and derive `actAs` from the authenticated user rather than trusting the request
  body (the current scaffold takes the acting party from the client for demo ease).
- Serve the built frontend (`npm run build`) behind the same origin as the backend,
  or point the Vite proxy / a reverse proxy at the deployed backend.
- The backend is already typed from the DAR (`npm run gen:daml`). Re-run it whenever
  the Daml model changes; CI should regenerate and typecheck so a template change that
  breaks the mapping fails the build.

# Contract Rules

## Documentation on contract changes

- Maintain a `daml/docs/` directory containing a `<ContractName>.md` file for each contract.
- Each `<ContractName>.md` documents, for that contract:
  - **Purpose** — what the contract is for.
  - **Parties** — the parties involved and their roles.
  - **Methods** — every choice/function, with its purpose.
- Update the relevant `<ContractName>.md` on every contract change or update so the docs stay in sync with the code.

## Rebuilding & regenerating JS bindings

- After any change to a DAML contract, rebuild the DAR and regenerate the TypeScript/JS bindings so the frontend and backend stay in sync with the contracts.
  1. Rebuild the DAR (e.g. `daml build` / `dpm build`) so `.daml/dist/vesting-<version>.dar` reflects the latest contracts.
  2. From `vesting-app-canton/backend`, regenerate the bindings with the codegen command:
     ```
     npm run gen:daml
     ```
     which runs `dpm codegen-js ../../.daml/dist/vesting-<version>.dar -o daml-ts`.
- If the DAR version changes, update the version in the `gen:daml` script and the corresponding `@daml.js/vesting-<version>` dependency in `package.json`.

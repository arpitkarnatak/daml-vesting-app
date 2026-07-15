# Vesting App — Token Vesting on Canton

A small Daml model that grants an employee Canton Coin on a **vesting schedule**: the
company proposes a grant, the employee accepts, and the company then releases coin
tranche-by-tranche as each portion vests over time.

- **SDK:** Daml `3.5.2` (see [daml.yaml](daml.yaml))
- **Source:** [daml/](daml/)

## Documentation

- **Per-contract reference** — [daml/docs/](daml/docs/):
  [CantonCoin.md](daml/docs/CantonCoin.md) ·
  [VestingSchedule.md](daml/docs/VestingSchedule.md) ·
  [VestingAgreement.md](daml/docs/VestingAgreement.md)
- **Contributor guides** — [Contract Rules](docs/CONTRACT_RULES.md) (documentation
  requirements for contract changes) · [Testing Strategy](docs/TESTING_STRATEGY.md)
  (how tests are structured and where they live).
- **Web app** — [vesting-app-canton/](vesting-app-canton/README.md): a fully-mediated
  React + backend app driving the propose → accept → release flow over the Canton JSON
  Ledger API.

## Running the app

### Prerequisites

- `dpm` installed, with its path added to your `PATH` environment variable.

### Steps

1. **Compile the contracts.** From the repo root, run:

   ```bash
   dpm build
   ```

2. **Start the sandbox** and keep it running:

   ```bash
   dpm sandbox
   ```

3. **Upload the DAR binaries.** From a new terminal, upload the compiled DAR:

   ```bash
   curl -X POST http://localhost:6864/v2/packages \
     -H "Content-Type: application/octet-stream" \
     --data-binary @.daml/dist/vesting-1.0.1.dar
   ```

4. **Start the web app.** Go to [vesting-app-canton/](vesting-app-canton/) and, in two
   separate terminals, install dependencies and start the frontend and backend
   simultaneously:

   ```bash
   npm install
   npm run dev
   ```

### Restarting

When restarting:

1. Stop the sandbox process and start it again (`dpm sandbox`).
2. Re-upload the DAR binaries with the `curl` command above.
3. Restart the frontend and backend apps.
4. In the browser, delete the `vestingAuthToken` key from local storage and refresh.

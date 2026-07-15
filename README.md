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

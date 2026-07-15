# VestingSchedule

Source: [VestingSchedule.daml](../VestingSchedule.daml)

## Purpose

Defines the plain data types that describe a vesting plan, plus a helper
function. These are not templates (no on-ledger contracts, no signatories or
choices) — they are the value types embedded inside a `VestingProposal` /
`VestingAgreement`. A vesting plan unlocks coin only after a cliff, and each
tranche unlocks at its own offset in time.

## Parties

None. These are pure data types and a pure function; no parties, signatories,
observers, or controllers are involved.

## Data Types

- **Tranche** — a single unlock event.
  - `offset: RelTime` — how much time must elapse after the schedule's
    `startDate` before this portion becomes claimable.
  - `amount: Decimal` — the number of Canton Coins that unlock at that time.
- **VestingSchedule** — the full vesting plan.
  - `startDate: Date` — the reference date the plan is anchored to.
  - `cliffDuration: RelTime` — nothing vests before `startDate + cliffDuration`.
  - `tranches: [Tranche]` — the unlock events, released one at a time.

## Methods

- **totalShares** (`VestingSchedule -> Decimal`) — Returns the total number of
  Canton Coins granted across every tranche (the sum of each tranche's
  `amount`).

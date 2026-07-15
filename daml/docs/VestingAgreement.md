# VestingAgreement

Source: [VestingAgreement.daml](../VestingAgreement.daml)

This module defines two templates: `VestingProposal` (the offer) and
`VestingAgreement` (the accepted, binding grant). It depends on
[VestingSchedule](VestingSchedule.md) for the plan shape and
[CantonCoin](CantonCoin.md) for the asset paid out.

---

## VestingProposal

### Purpose

A proposal the company offers to an employee. It only becomes a binding
`VestingAgreement` once the employee accepts, so both parties end up as
signatories of the agreement (neither can be bound without consenting).

The `ensure` clause rejects nonsensical grants at creation time:

- the schedule must have at least one tranche;
- every tranche `amount` must be `> 0.0`;
- `cliffDuration` must be `>= 0` (a `RelTime` can be negative; a backwards
  cliff is rejected);
- every tranche `offset` must be `>= 0` (durations may not point backwards in
  time).

### Parties

- **company** — makes the offer. Signatory of the proposal.
- **employee** — the recipient. Observer of the proposal, and controller of
  both `Accept` and `Reject`.

### Methods

- **Accept** (`controller employee`) — Creates the binding `VestingAgreement`
  with the same `company`, `employee`, and `schedule`, an empty `released`
  list, and `startTime` set to the current ledger time. Cliff and tranche
  offsets are counted from this accept time.
- **Reject** (`controller employee`) — Declines the offer. Archives the
  proposal and does nothing else.

---

## VestingAgreement

### Purpose

The active vesting agreement. The employee claims coin tranche-by-tranche as
each one vests — the company cannot withhold a vested tranche once it is
unlocked. The `released` list records which tranche indices have already paid
out, so no tranche can be claimed twice.

`startTime` is the instant the agreement was accepted; cliff and tranche
offsets count from here rather than from midnight of `schedule.startDate`.
Anchoring to the calendar date would make every offset trivially already
elapsed as soon as it is past midnight on that date, regardless of when the
grant was actually accepted.

### Parties

- **company** — the issuer of the grant. Signatory; its signature authorizes
  the coin payout.
- **employee** — the grantee. Signatory, and controller of `ReleaseTranche`
  (only the employee can invoke the claim).

### Methods

- **ReleaseTranche** (`controller employee`) — Claims the vested portion for a
  given `trancheIndex`, returning the updated agreement and a new `CantonCoin`
  holding. It fails unless:
  - the tranche has not already been released (`trancheIndex` not in
    `released`);
  - `trancheIndex` is a valid index into `schedule.tranches`;
  - the cliff has passed (`now >= startTime + cliffDuration`);
  - the tranche's own offset has elapsed (`now >= startTime + tranche.offset`).

  On success it mints a `CantonCoin` (issuer = company, owner = employee,
  amount = the tranche amount), then archives this agreement and recreates it
  with `trancheIndex` prepended to `released`.

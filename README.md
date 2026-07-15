# intro-parties — Token Vesting on Canton

A small Daml model that grants an employee Canton Coin on a **vesting schedule**: the
company proposes a grant, the employee accepts, and the company then releases coin
tranche-by-tranche as each portion vests over time.

- **SDK:** Daml `3.5.2` (see [daml.yaml](daml.yaml))
- **Source:** [daml/](daml/)

## Modules at a glance

| Module | Purpose |
| --- | --- |
| [VestingSchedule.daml](daml/VestingSchedule.daml) | Plain data types describing *when* and *how much* coin unlocks. |
| [CantonCoin.daml](daml/CantonCoin.daml) | A minimal token contract standing in for real Canton Coin (Amulet). |
| [VestingAgreement.daml](daml/VestingAgreement.daml) | The core workflow: propose → accept → release tranches. |
| [VestingApp.daml](daml/VestingApp.daml) | An earlier/standalone `Vesting` template (not part of the main flow). |
| [VestingTest.daml](daml/VestingTest.daml) | An end-to-end Daml Script exercising the happy path and the failure cases. |

## Data structures (VestingSchedule)

These are **data records**, not templates — they carry no ledger identity of their own and
are embedded inside the contracts below.

### `Tranche`
A single unlock event within a plan.

| Field | Type | Meaning |
| --- | --- | --- |
| `offset` | `RelTime` | How much time after the schedule's `startDate` before this portion becomes claimable. |
| `amount` | `Decimal` | Number of Canton Coins released when this tranche vests. |

### `VestingSchedule`
The full plan.

| Field | Type | Meaning |
| --- | --- | --- |
| `startDate` | `Date` | The reference point all offsets are measured from. |
| `cliffDuration` | `RelTime` | Nothing vests before `startDate + cliffDuration`, regardless of tranche offsets. |
| `tranches` | `[Tranche]` | The unlock events, released one at a time. |

### `totalShares`
`totalShares : VestingSchedule -> Decimal` — sums `amount` across every tranche to give
the total coin granted by the plan.

## Contracts

### `CantonCoin` — [CantonCoin.daml](daml/CantonCoin.daml)

A minimal, self-contained stand-in for real Canton Coin (Amulet). Production Canton Coin
lives in the Splice `splice-amulet` package and implements the CIP-0056 token standard;
that isn't a dependency of this intro project, so a coin holding is modelled here as an
explicit contract between the `issuer` and the current `owner`.

- **Signatory:** `issuer` (here, the company that stands behind the coin)
- **Observer:** `owner` (who currently holds it)
- **Invariant:** `amount > 0.0`

| Field | Meaning |
| --- | --- |
| `issuer` | Who minted / backs the coin. |
| `owner` | Who currently holds it. |
| `amount` | How much coin this holding represents. |

**Choices**
- **`Transfer`** (controller: `owner`) — the owner hands the coin to `newOwner`, archiving
  this holding and creating a fresh one with the new owner. The issuer remains the
  signatory, mirroring how real token standards keep the issuer authorizing the asset.

### `VestingProposal` — [VestingAgreement.daml](daml/VestingAgreement.daml)

An offer the company extends to an employee. It becomes a binding agreement **only** once
the employee accepts, so that neither party is bound without consenting.

- **Signatory:** `company`
- **Observer:** `employee`
- **`ensure`:** the schedule has at least one tranche, and every tranche amount is `> 0.0`.

| Field | Meaning |
| --- | --- |
| `company` | The grantor making the offer. |
| `employee` | The recipient being offered the grant. |
| `schedule` | The proposed `VestingSchedule`. |

**Choices**
- **`Accept`** (controller: `employee`) → `ContractId VestingAgreement`. Creates the active
  `VestingAgreement` with `released = []` (nothing paid out yet).
- **`Reject`** (controller: `employee`) → `()`. Archives the proposal with no further effect.

### `VestingAgreement` — [VestingAgreement.daml](daml/VestingAgreement.daml)

The active, mutually-signed agreement. The company releases coin tranche-by-tranche as each
one vests; `released` records which tranche **indices** have already paid out so none can be
claimed twice.

- **Signatory:** `company`, `employee` (both — this is why acceptance is required)

| Field | Meaning |
| --- | --- |
| `company` | The grantor. |
| `employee` | The recipient. |
| `schedule` | The agreed `VestingSchedule`. |
| `released` | Indices of tranches already released. |

**Choices**
- **`ReleaseTranche`** (controller: `company`) with `trancheIndex: Int`
  → `(ContractId VestingAgreement, ContractId CantonCoin)`.

  Pays out one tranche. It performs these checks, and fails the whole transaction if any
  does not hold:
  1. `trancheIndex` is **not** already in `released` (`"tranche already released"`).
  2. `trancheIndex` is a valid index into `schedule.tranches` (`"invalid tranche index"`).
  3. The cliff has passed: `now >= startDate + cliffDuration` (`"cliff has not been reached yet"`).
  4. The tranche's own offset has elapsed: `now >= startDate + tranche.offset` (`"tranche has not vested yet"`).

  On success it **mints a `CantonCoin`** (issuer = company, owner = employee, amount =
  the tranche's amount), then **archives this agreement and recreates it** with
  `trancheIndex` prepended to `released`. It returns both the updated agreement and the new
  coin.

### `Vesting` — [VestingApp.daml](daml/VestingApp.daml)

A standalone template that appears to be an earlier or alternative sketch of the grant
(fields `grantor` / `receiver` rather than `company` / `employee`). It carries only
signatory/observer roles and `ensure` invariants (non-empty tranches, positive amounts,
non-negative cliff) and **no choices** — it is not part of the propose→accept→release flow
described above. Kept for reference.

## Happy path

Time flows in ledger time; offsets and the cliff are all measured from `schedule.startDate`.

1. **Propose** — the company creates a `VestingProposal` for the employee with a
   `VestingSchedule`.
2. **Accept** — the employee exercises `Accept`, producing a `VestingAgreement` signed by
   both parties (`released = []`). (Or `Reject`, ending the flow.)
3. **Release, tranche by tranche** — once the cliff has passed and a given tranche's offset
   has elapsed, the company exercises `ReleaseTranche trancheIndex`. This mints a
   `CantonCoin` for the employee and returns an updated agreement recording that tranche as
   released.
4. Repeat step 3 for each tranche as it vests. The employee ends up holding one `CantonCoin`
   per released tranche.

Guard rails enforced along the way:
- Releasing a tranche **before the cliff** or **before its offset** fails.
- Releasing the **same tranche twice** fails.
- An **invalid tranche index** fails.

## Worked example (from the test)

[VestingTest.daml](daml/VestingTest.daml) runs the full scenario as a Daml Script:

- Schedule: `startDate = 2026-07-14`, `cliffDuration = 30 days`, three tranches at offsets
  `30d / 60d / 90d`, each `100.0` coin.
- At day 0 (start), `ReleaseTranche 0` fails — nothing has vested (before the cliff).
- After **40 days**, tranche 0 (offset 30d, past the 30d cliff) releases → employee gets a
  `100.0` coin. Tranche 2 (offset 90d) still fails.
- After a further **60 days** (100 days total), tranche 1 releases; re-releasing tranche 1
  fails; tranche 2 releases.
- The employee ends up holding **all three** coins.

## Running

Requires the [Daml SDK](https://docs.daml.com/) (`3.5.2`).

```bash
# Type-check / build
daml build

# Run the test scenario
daml test
```

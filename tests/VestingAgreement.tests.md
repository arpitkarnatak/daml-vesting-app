# VestingAgreement — Test Spec

Runnable tests: [`daml/VestingAgreementTest.daml`](daml/VestingAgreementTest.daml).

Covers both templates in the module: `VestingProposal` (its `ensure`, `Accept`,
`Reject`) and `VestingAgreement` (`ReleaseTranche`). Parties used: `company` and
`employee` (the two signatories) and `stranger` (an unauthorized third party).

## `VestingProposal.ensure` — conjunction of four clauses

The `ensure` is `not (null tranches) && all amount > 0 && cliffDuration >= 0 &&
all offset >= 0`. Each clause is broken in isolation while the others hold, so a
failure pinpoints the responsible clause; plus the all-satisfied create.

| Clause under test | Input | Expected |
| --- | --- | --- |
| all satisfied | valid schedule | create succeeds |
| `not (null tranches)` | `tranches = []` | create fails |
| `all amount > 0` | amount `0.0` | create fails |
| `all amount > 0` | amount `-5.0` | create fails |
| `cliffDuration >= 0` | cliff `-1s` | create fails |
| `all offset >= 0` | offset `-1s` | create fails |

## `Accept` / `Reject` — controller is `employee`

| Actor | Choice | Expected |
| --- | --- | --- |
| employee | Accept | agreement created, `released = []`, terms preserved |
| company | Accept | fails (observer, not controller) |
| stranger | Accept | fails (unauthorized) |
| employee | Reject | proposal archived, no agreement |
| stranger | Reject | fails (unauthorized) |

## `ReleaseTranche` — ordered guards (decision tree)

Guards evaluate in order and short-circuit:
1. `trancheIndex notElem released` — not already released
2. index in range — else `abort "invalid tranche index"`
3. `now >= cliffTime`
4. `now >= unlockTime`

Because the guards short-circuit, only reachable leaves are enumerated. Guards
(3) and (4) form a 2×2 timing tree; the (false, true)/(true, false) branches are
isolated with a schedule where cliff and tranche offsets are deliberately
ordered so exactly one guard is unmet.

| # | Precondition | Time | Actor | Guard hit | Expected |
| --- | --- | --- | --- | --- | --- |
| cliff & vest unmet | cliff 50s, tranche 100s | +0s | employee | (3) | fails |
| cliff unmet, vest met | cliff 200s, tranche 50s | +100s | employee | (3) | fails |
| cliff met, vest unmet | cliff 50s, tranche 200s | +100s | employee | (4) | fails |
| both met | cliff 50s, tranche 100s | +100s | employee | — | coin `10.0` minted, `released = [0]` |
| invalid index (high) | valid, all vested | +300s | employee | (2) | fails |
| invalid index (negative) | valid, all vested | +300s | employee | (2) | fails |
| already released | release 0, then release 0 again | +100s | employee | (1) | 2nd fails |
| multiple tranches | release 0 (+100s), then 1 (+200s) | staged | employee | — | both succeed, `released = [1, 0]`, 2nd coin `20.0` |
| company releases | both met | +100s | company | authorization | fails (signatory, not controller) |
| stranger releases | both met | +100s | stranger | authorization | fails (unauthorized) |

# VestingSchedule — Test Spec

Runnable tests: [`daml/VestingScheduleTest.daml`](daml/VestingScheduleTest.daml).

`VestingSchedule` is pure data (`Tranche`, `VestingSchedule`) with one function,
`totalShares`, which sums every tranche's `amount`. There are no choices or
parties to exercise, so coverage is fuzzing over the summation.

## Fuzz cases — `totalShares`

| Case | Input tranches | Expected |
| --- | --- | --- |
| Empty | `[]` | `0.0` |
| Single | `[42.0]` | `42.0` |
| Multiple | `[10.0, 20.5, 4.25]` | `34.75` |
| Small decimals | `[1e-10, 2e-10]` | `3e-10` (no precision loss at Decimal scale) |
| Large sum | `[1e9, 2e9, 3e9]` | `6e9` (no overflow) |

Offsets and `cliffDuration` do not affect `totalShares` and are held constant.

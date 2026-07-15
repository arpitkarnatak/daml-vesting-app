# Testing Strategy

## Layout

- Tests live in a dedicated directory, **separate** from the `daml/` directory where contracts live.
- Each contract has its own test spec file: `<ContractName>.tests.md`.
- When a contract is added, updated, or removed, update its `<ContractName>.tests.md` to add, remove, or revise test cases and edge cases accordingly.

## What to cover

- **Fuzzing**: when a contract works with numbers, strings, and similar values, include fuzz cases (boundary values, empty/oversized inputs, negatives, overflow, malformed data).
- **Parties & permissions**: exercise parties at different permission levels (e.g. signatory, observer, controller, unauthorized party) to confirm authorization is enforced.

## Tree-like coverage

Design test cases as a decision tree over the contract's conditions:

- For every set of nested boolean conditions, enumerate all combinations. Two nested boolean conditions → **4** test cases covering every combo.
- Do **not** write test cases for combinations that are unreachable (i.e. the code path cannot be executed).

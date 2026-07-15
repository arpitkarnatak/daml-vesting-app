# CantonCoin

Source: [CantonCoin.daml](../CantonCoin.daml)

## Purpose

A minimal, self-contained stand-in for Canton Coin (Amulet). The production
Canton Coin lives in the Splice `splice-amulet` package and implements the
CIP-0056 token standard, which is not a dependency of this intro project.
Instead, a coin holding is modelled as an explicit contract between the issuer
and the current owner, so the vesting logic can map directly onto the real
standard's transfer choices later.

The template enforces `amount > 0.0`: a holding must always represent a
positive quantity of coin.

## Parties

- **issuer** — who minted / stands behind the coin (here: the company).
  Signatory of the holding; remains the signatory across transfers, mirroring
  how token standards keep the issuer authorizing the asset.
- **owner** — who currently holds the coin. Observer, and controller of
  `Transfer`.

## Methods

- **Transfer** (`controller owner`) — Moves the coin to `newOwner`. Archives the
  current holding and creates a new `CantonCoin` with the same `issuer` and
  `amount` but the new owner. The issuer stays the signatory of the resulting
  holding.

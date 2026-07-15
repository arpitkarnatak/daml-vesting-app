import { randomBytes } from "crypto";

// Maps an opaque bearer token to the single party it authenticates as.
// Issued once, when a party is allocated -- whoever holds the token is the
// only one who can submit ledger commands on that party's behalf.
const tokenToParty = new Map<string, string>();

export function issueToken(party: string): string {
  const token = randomBytes(24).toString("hex");
  tokenToParty.set(token, party);
  return token;
}

export function partyForToken(token: string): string | undefined {
  return tokenToParty.get(token);
}

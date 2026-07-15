// Thin typed client over the backend REST API. The frontend NEVER calls the
// ledger directly — this is the whole point of the fully-mediated pattern.

export interface PartyDetails {
  party: string;
  isLocal?: boolean;
}

// Returned only once, at allocation time -- it's the sole credential for
// acting as this party. Never derive an acting party from anything else.
export interface AllocatedParty extends PartyDetails {
  token: string;
}

export interface TrancheDto {
  offsetSeconds: number;
  amount: string;
}

export interface ScheduleDto {
  startDate: string;
  cliffSeconds: number;
  tranches: TrancheDto[];
}

export interface Proposal {
  contractId: string;
  company: string;
  employee: string;
  schedule: ScheduleDto;
}

export interface Agreement {
  contractId: string;
  company: string;
  employee: string;
  schedule: ScheduleDto;
  released: number[];
}

export interface Coin {
  contractId: string;
  issuer: string;
  owner: string;
  amount: string;
}

async function req<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return (text ? JSON.parse(text) : undefined) as T;
}

// Every call below that acts "as" a party takes that party's token, never a
// party name -- the backend derives the acting party from the token, so a
// caller can never simply name a party it doesn't hold a token for.
export const api = {
  listParties: () => req<PartyDetails[]>("/parties"),
  allocateParty: (hint: string) =>
    req<AllocatedParty>("/parties", { method: "POST", body: JSON.stringify({ hint }) }),

  listProposals: (token: string) => req<Proposal[]>("/proposals", undefined, token),
  createProposal: (token: string, employee: string, schedule: ScheduleDto) =>
    req<{ contractId: string }>(
      "/proposals",
      { method: "POST", body: JSON.stringify({ employee, schedule }) },
      token,
    ),
  acceptProposal: (token: string, cid: string) =>
    req<{ agreementContractId: string }>(
      `/proposals/${encodeURIComponent(cid)}/accept`,
      { method: "POST" },
      token,
    ),
  rejectProposal: (token: string, cid: string) =>
    req<{ ok: true }>(`/proposals/${encodeURIComponent(cid)}/reject`, { method: "POST" }, token),

  listAgreements: (token: string) => req<Agreement[]>("/agreements", undefined, token),
  releaseTranche: (token: string, cid: string, trancheIndex: number) =>
    req<{ newAgreementContractId: string; coinContractId: string }>(
      `/agreements/${encodeURIComponent(cid)}/release`,
      { method: "POST", body: JSON.stringify({ trancheIndex }) },
      token,
    ),

  listCoins: (token: string) => req<Coin[]>("/coins", undefined, token),
};

import { config } from "./config.js";
import { getAuthHeader } from "./token.js";

// ---------------------------------------------------------------------------
// Low-level client for the Canton JSON Ledger API (v2).
//
// This is the ONLY module that talks to the ledger. Everything above it
// (routes.ts) deals in plain REST DTOs — this is what "fully mediated" means:
// the browser never sees a template id, a party token, or a ledger offset.
// ---------------------------------------------------------------------------

async function ledgerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${config.ledgerUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeader()),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new LedgerError(res.status, text || res.statusText);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export class LedgerError extends Error {
  constructor(public status: number, public body: string) {
    super(`Ledger API ${status}: ${body}`);
  }
}

// A command element as accepted by /v2/commands. Exactly one key is set.
export type Command =
  | { CreateCommand: { templateId: string; createArguments: unknown } }
  | {
      ExerciseCommand: {
        templateId: string;
        contractId: string;
        choice: string;
        choiceArgument: unknown;
      };
    };

// Shape of a created event as returned inside a transaction's events.
export interface CreatedEvent {
  contractId: string;
  templateId: string;
  createArgument?: unknown;
  createArguments?: unknown;
}

let commandSeq = 0;
function commandId(prefix: string): string {
  // Deterministic-ish unique id for ledger command deduplication.
  commandSeq += 1;
  return `${prefix}-${Date.now()}-${commandSeq}`;
}

/**
 * Submit commands and wait for the resulting transaction, so we can read back
 * created contract ids and exercise results. `actAs` are the parties whose
 * authority the commands are submitted with.
 */
export async function submit(
  actAs: string[],
  commands: Command[],
  opts: { prefix?: string; readAs?: string[] } = {},
): Promise<Transaction> {
  const body = {
    commands: {
      commands,
      commandId: commandId(opts.prefix ?? "cmd"),
      userId: config.userId,
      actAs,
      readAs: opts.readAs ?? [],
    },
  };
  const res = await ledgerFetch<{ transaction: Transaction }>(
    "/v2/commands/submit-and-wait-for-transaction",
    { method: "POST", body: JSON.stringify(body) },
  );
  return res.transaction;
}

export interface Transaction {
  updateId: string;
  offset: number;
  events: Array<
    | { CreatedEvent?: CreatedEvent; created?: CreatedEvent }
    | { ExercisedEvent?: { exerciseResult?: unknown }; exercised?: { exerciseResult?: unknown } }
  >;
}

/** Pull every created event out of a transaction, tolerating shape variants. */
export function createdEvents(tx: Transaction): CreatedEvent[] {
  const out: CreatedEvent[] = [];
  for (const e of tx.events ?? []) {
    const c = (e as any).CreatedEvent ?? (e as any).created;
    if (c?.contractId) out.push(c);
  }
  return out;
}

/** The result value of the first exercised choice in a transaction, if any. */
export function firstExerciseResult(tx: Transaction): unknown {
  for (const e of tx.events ?? []) {
    const x = (e as any).ExercisedEvent ?? (e as any).exercised;
    if (x && "exerciseResult" in x) return x.exerciseResult;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Reads: active contracts of a given template, visible to a given party.
// ---------------------------------------------------------------------------

export interface ActiveContract<T = unknown> {
  contractId: string;
  templateId: string;
  payload: T;
}

async function ledgerEnd(): Promise<number> {
  const res = await ledgerFetch<{ offset: number }>("/v2/state/ledger-end");
  return res.offset;
}

/**
 * Query the Active Contract Set for one template, as seen by `party`.
 * v2 requires an `activeAtOffset`; we snapshot at the current ledger end.
 */
export async function queryActive<T = unknown>(
  party: string,
  templateId: string,
): Promise<ActiveContract<T>[]> {
  const activeAtOffset = await ledgerEnd();
  const body = {
    activeAtOffset,
    verbose: false,
    eventFormat: {
      filtersByParty: {
        [party]: {
          cumulative: [
            {
              identifierFilter: {
                TemplateFilter: {
                  value: { templateId, includeCreatedEventBlob: false },
                },
              },
            },
          ],
        },
      },
      verbose: false,
    },
  };

  // The ACS endpoint returns a JSON array (one element per active contract).
  const rows = await ledgerFetch<any[]>("/v2/state/active-contracts", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const out: ActiveContract<T>[] = [];
  for (const row of rows ?? []) {
    // Tolerate the nesting variants across Canton point releases.
    const created =
      row?.contractEntry?.JsActiveContract?.createdEvent ??
      row?.activeContract?.createdEvent ??
      row?.createdEvent ??
      row?.CreatedEvent;
    if (!created?.contractId) continue;
    out.push({
      contractId: created.contractId,
      templateId: created.templateId,
      payload: (created.createArgument ?? created.createArguments) as T,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

export interface PartyDetails {
  party: string;
  isLocal?: boolean;
}

export async function listParties(): Promise<PartyDetails[]> {
  const res = await ledgerFetch<{ partyDetails?: PartyDetails[] } | PartyDetails[]>(
    "/v2/parties",
  );
  return Array.isArray(res) ? res : res.partyDetails ?? [];
}

export async function allocateParty(hint: string): Promise<PartyDetails> {
  const res = await ledgerFetch<{ partyDetails: PartyDetails }>("/v2/parties", {
    method: "POST",
    body: JSON.stringify({ partyIdHint: hint }),
  });
  return res.partyDetails;
}

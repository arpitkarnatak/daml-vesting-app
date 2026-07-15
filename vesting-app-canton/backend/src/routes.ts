import { Router } from "express";
import {
  submit,
  queryActive,
  createdEvents,
  listParties,
  allocateParty,
  LedgerError,
} from "./ledger.js";
import { issueToken, partyForToken } from "./auth.js";
import {
  templateIds,
  scheduleToDaml,
  scheduleFromDaml,
  releaseArg,
  releasedToDto,
  type ScheduleDto,
  type ProposalPayload,
  type AgreementPayload,
  type CoinPayload,
} from "./daml.js";

export const router = Router();

// Wrap async handlers so thrown errors become clean HTTP responses.
const h =
  (fn: (req: any, res: any) => Promise<void>) =>
  (req: any, res: any) =>
    fn(req, res).catch((err) => {
      if (err instanceof LedgerError) {
        res.status(502).json({ error: "ledger_error", status: err.status, detail: err.body });
      } else {
        console.error(err);
        res.status(500).json({ error: "internal_error", detail: String(err?.message ?? err) });
      }
    });

// The acting party is always derived from the caller's bearer token, never
// from a request body/query field -- otherwise any caller could name any
// party and act on its behalf. A token is only ever handed to whoever
// allocated that party (see POST /parties).
function requireAuth(req: any, res: any): string | null {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
  const party = token ? partyForToken(token) : undefined;
  if (!party) {
    res.status(401).json({ error: "unauthorized", detail: "missing or invalid bearer token" });
    return null;
  }
  return party;
}

// ---- Parties ----

router.get(
  "/parties",
  h(async (_req, res) => {
    res.json(await listParties());
  }),
);

router.post(
  "/parties",
  h(async (req, res) => {
    const { hint } = req.body as { hint: string };
    if (!hint) return res.status(400).json({ error: "hint is required" });
    const party = await allocateParty(hint);
    // Handed back only to the caller who allocated this party -- this is its
    // one and only credential.
    res.json({ ...party, token: issueToken(party.party) });
  }),
);

// ---- Proposals ----

router.get(
  "/proposals",
  h(async (req, res) => {
    const party = requireAuth(req, res);
    if (!party) return;
    const rows = await queryActive<ProposalPayload>(party, templateIds.VestingProposal);
    res.json(
      rows.map((r) => ({
        contractId: r.contractId,
        company: r.payload.company,
        employee: r.payload.employee,
        schedule: scheduleFromDaml(r.payload.schedule),
      })),
    );
  }),
);

router.post(
  "/proposals",
  h(async (req, res) => {
    // company is the sole signatory of the proposal -> must be the caller.
    const company = requireAuth(req, res);
    if (!company) return;
    const { employee, schedule } = req.body as { employee: string; schedule: ScheduleDto };
    if (!employee || !schedule) {
      return res.status(400).json({ error: "employee and schedule are required" });
    }
    const tx = await submit(
      [company],
      [
        {
          CreateCommand: {
            templateId: templateIds.VestingProposal,
            createArguments: { company, employee, schedule: scheduleToDaml(schedule) },
          },
        },
      ],
      { prefix: "propose" },
    );
    const created = createdEvents(tx)[0];
    res.json({ contractId: created?.contractId });
  }),
);

router.post(
  "/proposals/:cid/accept",
  h(async (req, res) => {
    // Accept is controlled by the employee -> must be the caller.
    const employee = requireAuth(req, res);
    if (!employee) return;
    const tx = await submit(
      [employee],
      [
        {
          ExerciseCommand: {
            templateId: templateIds.VestingProposal,
            contractId: req.params.cid,
            choice: "Accept",
            choiceArgument: {},
          },
        },
      ],
      { prefix: "accept" },
    );
    const agreement = createdEvents(tx).find(
      (e) => e.templateId?.endsWith(":VestingAgreement"),
    );
    res.json({ agreementContractId: agreement?.contractId });
  }),
);

router.post(
  "/proposals/:cid/reject",
  h(async (req, res) => {
    // Reject is controlled by the employee -> must be the caller.
    const employee = requireAuth(req, res);
    if (!employee) return;
    await submit(
      [employee],
      [
        {
          ExerciseCommand: {
            templateId: templateIds.VestingProposal,
            contractId: req.params.cid,
            choice: "Reject",
            choiceArgument: {},
          },
        },
      ],
      { prefix: "reject" },
    );
    res.json({ ok: true });
  }),
);

// ---- Agreements ----

router.get(
  "/agreements",
  h(async (req, res) => {
    const party = requireAuth(req, res);
    if (!party) return;
    const rows = await queryActive<AgreementPayload>(party, templateIds.VestingAgreement);
    res.json(
      rows.map((r) => ({
        contractId: r.contractId,
        company: r.payload.company,
        employee: r.payload.employee,
        schedule: scheduleFromDaml(r.payload.schedule),
        released: releasedToDto(r.payload.released),
      })),
    );
  }),
);

router.post(
  "/agreements/:cid/release",
  h(async (req, res) => {
    // ReleaseTranche is controlled by the employee -> must be the caller.
    const employee = requireAuth(req, res);
    if (!employee) return;
    const { trancheIndex } = req.body as { trancheIndex: number };
    if (typeof trancheIndex !== "number") {
      return res.status(400).json({ error: "numeric trancheIndex is required" });
    }
    const tx = await submit(
      [employee],
      [
        {
          ExerciseCommand: {
            templateId: templateIds.VestingAgreement,
            contractId: req.params.cid,
            choice: "ReleaseTranche",
            choiceArgument: releaseArg(trancheIndex),
          },
        },
      ],
      { prefix: "release" },
    );
    const created = createdEvents(tx);
    res.json({
      newAgreementContractId: created.find((e) => e.templateId?.endsWith(":VestingAgreement"))
        ?.contractId,
      coinContractId: created.find((e) => e.templateId?.endsWith(":CantonCoin"))?.contractId,
    });
  }),
);

// ---- Coins ----

router.get(
  "/coins",
  h(async (req, res) => {
    const party = requireAuth(req, res);
    if (!party) return;
    const rows = await queryActive<CoinPayload>(party, templateIds.CantonCoin);
    res.json(
      rows.map((r) => ({
        contractId: r.contractId,
        issuer: r.payload.issuer,
        owner: r.payload.owner,
        amount: r.payload.amount,
      })),
    );
  }),
);

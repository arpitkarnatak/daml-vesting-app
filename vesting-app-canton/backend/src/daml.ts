import { VestingAgreement as VA, CantonCoin as CC, VestingSchedule as VS } from "@daml.js/vesting-1.0.0";

// ---------------------------------------------------------------------------
// Domain mapping: REST DTOs  <->  Daml payloads for the `vesting` package.
//
// The Daml payload TYPES here come straight from `dpm codegen-js` output
// (`../daml-ts`, re-run with `npm run gen:daml`). If a template's fields change,
// this file stops compiling until it's updated — that's the whole point.
// ---------------------------------------------------------------------------

// Template ids carried by the generated template constants, e.g.
//   '#vesting:VestingAgreement:VestingProposal'
export const templateIds = {
  VestingProposal: VA.VestingProposal.templateId,
  VestingAgreement: VA.VestingAgreement.templateId,
  CantonCoin: CC.CantonCoin.templateId,
};

// Daml payload types (from the DAR). Re-exported for routes.ts.
export type ProposalPayload = VA.VestingProposal;
export type AgreementPayload = VA.VestingAgreement;
export type CoinPayload = CC.CantonCoin;
export type ReleaseTrancheArg = VA.ReleaseTranche;

// Derive the RelTime shape from the generated schedule rather than importing
// the daml-stdlib package directly — keeps our imports to one package.
type DamlSchedule = VS.VestingSchedule;
type RelTime = DamlSchedule["cliffDuration"]; // { microseconds: Int }  (Int is a string)

const MICROS_PER_SECOND = 1_000_000n;

const relTime = {
  fromSeconds: (seconds: number): RelTime => ({
    microseconds: (BigInt(seconds) * MICROS_PER_SECOND).toString(),
  }),
  toSeconds: (rt: RelTime): number => Number(BigInt(rt.microseconds) / MICROS_PER_SECOND),
};

// --- REST DTOs (what the frontend sends/receives) ---
// Scalar encodings over the JSON Ledger API, per @daml/types:
//   Party=string, Date="YYYY-MM-DD", Decimal/Numeric=string, Int=string,
//   RelTime={ microseconds: <string> }.

export interface TrancheDto {
  offsetSeconds: number; // time after startDate before this tranche vests
  amount: string; // decimal, as string
}

export interface ScheduleDto {
  startDate: string; // YYYY-MM-DD
  cliffSeconds: number;
  tranches: TrancheDto[];
}

// --- DTO -> Daml payload ---

export function scheduleToDaml(s: ScheduleDto): DamlSchedule {
  return {
    startDate: s.startDate,
    cliffDuration: relTime.fromSeconds(s.cliffSeconds),
    tranches: s.tranches.map((t) => ({
      offset: relTime.fromSeconds(t.offsetSeconds),
      amount: t.amount,
    })),
  };
}

export const releaseArg = (trancheIndex: number): ReleaseTrancheArg => ({
  trancheIndex: String(trancheIndex),
});

// --- Daml payload -> DTO (for reads) ---

export function scheduleFromDaml(s: DamlSchedule): ScheduleDto {
  return {
    startDate: s.startDate,
    cliffSeconds: relTime.toSeconds(s.cliffDuration),
    tranches: (s.tranches ?? []).map((t) => ({
      offsetSeconds: relTime.toSeconds(t.offset),
      amount: t.amount,
    })),
  };
}

// `released` is Int[] (string[]) on the ledger; expose plain numbers to the UI.
export const releasedToDto = (released: AgreementPayload["released"]): number[] =>
  (released ?? []).map(Number);

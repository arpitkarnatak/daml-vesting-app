import { useCallback, useEffect, useState } from "react";
import {
  api,
  type Agreement,
  type Coin,
  type PartyDetails,
  type Proposal,
} from "./api";

const TOKENS_KEY = "vestingAuthTokens";

function loadStoredTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function App() {
  const [parties, setParties] = useState<PartyDetails[]>([]);
  // Tokens this browser holds -- i.e. the parties it can actually act as.
  // Never derived from the full `parties` directory: holding a party's name
  // is not the same as holding its credential.
  const [authTokens, setAuthTokens] = useState<Record<string, string>>(loadStoredTokens);
  const [acting, setActing] = useState<string>(""); // the logged-in party whose view we show
  const [error, setError] = useState<string | null>(null);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);

  const guard = useCallback(async (fn: () => Promise<void>) => {
    try {
      setError(null);
      await fn();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  const rememberToken = useCallback((party: string, token: string) => {
    setAuthTokens((prev) => {
      const next = { ...prev, [party]: token };
      localStorage.setItem(TOKENS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const loadParties = useCallback(
    () =>
      guard(async () => {
        const ps = await api.listParties();
        setParties(ps);
      }),
    [guard],
  );

  useEffect(() => {
    if (!acting) {
      const first = Object.keys(authTokens)[0];
      if (first) setActing(first);
    }
  }, [acting, authTokens]);

  const refresh = useCallback(
    () =>
      guard(async () => {
        const token = authTokens[acting];
        if (!token) return;
        const [p, a, c] = await Promise.all([
          api.listProposals(token),
          api.listAgreements(token),
          api.listCoins(token),
        ]);
        setProposals(p);
        setAgreements(a);
        setCoins(c);
      }),
    [guard, acting, authTokens],
  );

  useEffect(() => {
    loadParties();
  }, [loadParties]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <h1>Token Vesting on Canton</h1>
      <p className="mono">React → backend REST → JSON Ledger API (fully mediated)</p>
      {error && <div className="error">Error: {error}</div>}

      <PartyBar
        parties={parties}
        loggedInParties={Object.keys(authTokens)}
        acting={acting}
        setActing={setActing}
        onAllocate={(hint) =>
          guard(async () => {
            const allocated = await api.allocateParty(hint);
            rememberToken(allocated.party, allocated.token);
            setActing(allocated.party);
            await loadParties();
          })
        }
        onRefresh={refresh}
      />

      <NewProposal
        parties={parties}
        actingParty={acting}
        actingToken={authTokens[acting]}
        onDone={refresh}
        guard={guard}
      />

      <section>
        <h2>Proposals ({proposals.length})</h2>
        {proposals.length === 0 && <p className="mono">none visible to acting party</p>}
        {proposals.map((p) => (
          <div className="card" key={p.contractId}>
            <div>
              <span className="pill">company</span>
              {short(p.company)} <span className="pill">employee</span>
              {short(p.employee)}
            </div>
            <ScheduleView schedule={p.schedule} />
            <div className="mono">{p.contractId}</div>
            <div className="row">
              {acting === p.employee ? (
                <>
                  <button
                    className="small"
                    onClick={() =>
                      guard(
                        async () =>
                          void (await api.acceptProposal(authTokens[acting], p.contractId), refresh()),
                      )
                    }
                  >
                    Accept (as employee)
                  </button>
                  <button
                    className="small"
                    onClick={() =>
                      guard(
                        async () =>
                          void (await api.rejectProposal(authTokens[acting], p.contractId), refresh()),
                      )
                    }
                  >
                    Reject (as employee)
                  </button>
                </>
              ) : (
                <span className="mono">log in as {short(p.employee)} to accept/reject</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Agreements ({agreements.length})</h2>
        {agreements.length === 0 && <p className="mono">none visible to acting party</p>}
        {agreements.map((a) => (
          <div className="card" key={a.contractId}>
            <div>
              <span className="pill">company</span>
              {short(a.company)} <span className="pill">employee</span>
              {short(a.employee)}
            </div>
            <ScheduleView schedule={a.schedule} released={a.released} />
            <div className="mono">{a.contractId}</div>
            <div className="row">
              {acting === a.employee ? (
                a.schedule.tranches.map((_, i) => (
                  <button
                    key={i}
                    className="small"
                    disabled={a.released.includes(i)}
                    onClick={() =>
                      guard(
                        async () =>
                          void (
                            await api.releaseTranche(authTokens[acting], a.contractId, i), refresh()
                          ),
                      )
                    }
                  >
                    {a.released.includes(i) ? `Tranche ${i} ✓` : `Release ${i} (as employee)`}
                  </button>
                ))
              ) : (
                <span className="mono">log in as {short(a.employee)} to release tranches</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Canton Coins held ({coins.length})</h2>
        {coins.length === 0 && <p className="mono">none visible to acting party</p>}
        {coins.map((c) => (
          <div className="card" key={c.contractId}>
            <strong>{c.amount}</strong> coin — owner {short(c.owner)}, issuer {short(c.issuer)}
            <div className="mono">{c.contractId}</div>
          </div>
        ))}
      </section>
    </>
  );
}

function PartyBar(props: {
  parties: PartyDetails[];
  loggedInParties: string[];
  acting: string;
  setActing: (p: string) => void;
  onAllocate: (hint: string) => void;
  onRefresh: () => void;
}) {
  const [hint, setHint] = useState("");
  return (
    <section>
      <h2>Party</h2>
      <p className="mono">
        Acting as a party requires holding its token (issued once, when it's allocated in this
        browser). You can't switch to a party you don't hold a token for.
      </p>
      <div className="row">
        <div>
          <label>Acting / viewing as (logged in)</label>
          <select value={props.acting} onChange={(e) => props.setActing(e.target.value)}>
            {props.loggedInParties.length === 0 && <option value="">— not logged in to any party —</option>}
            {props.loggedInParties.map((party) => (
              <option key={party} value={party}>
                {party}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Allocate a new party (hint) — logs you in as it</label>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Company" />
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button
            className="small"
            onClick={() => {
              props.onAllocate(hint);
              setHint("");
            }}
          >
            Allocate
          </button>
          <button className="small" onClick={props.onRefresh} style={{ marginLeft: 8 }}>
            Refresh
          </button>
        </div>
      </div>
      <p className="mono">All known parties: {props.parties.map((p) => short(p.party)).join(", ") || "none"}</p>
    </section>
  );
}

function NewProposal(props: {
  parties: PartyDetails[];
  actingParty: string;
  actingToken: string | undefined;
  onDone: () => void;
  guard: (fn: () => Promise<void>) => Promise<void>;
}) {
  const [employee, setEmployee] = useState("");
  const [startDate, setStartDate] = useState("2026-07-14");
  const [cliffSeconds, setCliffSeconds] = useState(30);
  const [tranches, setTranches] = useState([
    { offsetSeconds: 30, amount: "100.0" },
    { offsetSeconds: 60, amount: "100.0" },
    { offsetSeconds: 90, amount: "100.0" },
  ]);

  useEffect(() => {
    if (!employee && props.parties[0]) setEmployee(props.parties[0].party);
  }, [props.parties]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section>
      <h2>New vesting proposal</h2>
      <div className="row">
        <div>
          <label>Company (signatory)</label>
          <p className="mono">{props.actingParty || "— log in as a party first —"}</p>
        </div>
        <div>
          <label>Employee (receiver)</label>
          <PartySelect parties={props.parties} value={employee} onChange={setEmployee} />
        </div>
      </div>
      <div className="row">
        <div>
          <label>Start date</label>
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>Cliff (seconds)</label>
          <input
            type="number"
            value={cliffSeconds}
            onChange={(e) => setCliffSeconds(Number(e.target.value))}
          />
        </div>
      </div>
      <label>Tranches (offset seconds / amount)</label>
      {tranches.map((t, i) => (
        <div className="row" key={i}>
          <input
            type="number"
            value={t.offsetSeconds}
            onChange={(e) =>
              setTranches((ts) =>
                ts.map((x, j) => (j === i ? { ...x, offsetSeconds: Number(e.target.value) } : x)),
              )
            }
          />
          <input
            value={t.amount}
            onChange={(e) =>
              setTranches((ts) => ts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
            }
          />
        </div>
      ))}
      <button
        className="small"
        onClick={() => setTranches((ts) => [...ts, { offsetSeconds: 0, amount: "100.0" }])}
      >
        + tranche
      </button>
      <div>
        <button
          disabled={!props.actingToken}
          onClick={() =>
            props.guard(async () => {
              if (!props.actingToken) return;
              await api.createProposal(props.actingToken, employee, {
                startDate,
                cliffSeconds,
                tranches,
              });
              props.onDone();
            })
          }
        >
          Create proposal (as {props.actingParty || "…"})
        </button>
      </div>
    </section>
  );
}

function PartySelect(props: {
  parties: PartyDetails[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      <option value="">— select —</option>
      {props.parties.map((p) => (
        <option key={p.party} value={p.party}>
          {p.party}
        </option>
      ))}
    </select>
  );
}

function ScheduleView({ schedule, released }: { schedule: Proposal["schedule"]; released?: number[] }) {
  return (
    <div style={{ fontSize: "0.85rem", margin: "0.4rem 0" }}>
      start {schedule.startDate}, cliff {schedule.cliffSeconds}s ·{" "}
      {schedule.tranches.map((t, i) => (
        <span className="pill" key={i}>
          #{i}: {t.amount} @ {t.offsetSeconds}s{released?.includes(i) ? " ✓" : ""}
        </span>
      ))}
    </div>
  );
}

const short = (p: string) => (p.length > 22 ? `${p.slice(0, 12)}…${p.slice(-6)}` : p);

import { useCallback, useEffect, useState } from "react";
import {
  api,
  friendlyLedgerError,
  type Agreement,
  type Coin,
  type PartyDetails,
  type Proposal,
} from "./api";
import { Toaster, toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  Coins,
  FileSignature,
  Plus,
  RefreshCw,
  ScrollText,
  UserPlus,
} from "lucide-react";

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

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [coins, setCoins] = useState<Coin[]>([]);

  const guard = useCallback(async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      toast(friendlyLedgerError(e), { title: "Action failed", variant: "error" });
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Token Vesting on Canton
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          React → backend REST → JSON Ledger API (fully mediated)
        </p>
      </header>

      <Toaster />

      <div className="space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="text-primary" />
              Proposals
              <Badge variant="secondary">{proposals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposals.length === 0 && (
              <p className="font-mono text-sm text-muted-foreground">
                none visible to acting party
              </p>
            )}
            {proposals.map((p) => (
              <Card key={p.contractId} className="shadow-none">
                <CardContent className="space-y-3 p-4">
                  <PartyRow company={p.company} employee={p.employee} />
                  <ScheduleView schedule={p.schedule} />
                  <ContractId id={p.contractId} />
                  <div className="flex flex-wrap gap-2">
                    {acting === p.employee ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            guard(
                              async () =>
                                void (await api.acceptProposal(authTokens[acting], p.contractId), refresh()),
                            )
                          }
                        >
                          <Check /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            guard(
                              async () =>
                                void (await api.rejectProposal(authTokens[acting], p.contractId), refresh()),
                            )
                          }
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        log in as {short(p.employee)} to accept/reject
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="text-primary" />
              Agreements
              <Badge variant="secondary">{agreements.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agreements.length === 0 && (
              <p className="font-mono text-sm text-muted-foreground">
                none visible to acting party
              </p>
            )}
            {agreements.map((a) => (
              <Card key={a.contractId} className="shadow-none">
                <CardContent className="space-y-3 p-4">
                  <PartyRow company={a.company} employee={a.employee} />
                  <ScheduleView schedule={a.schedule} released={a.released} />
                  <ContractId id={a.contractId} />
                  <div className="flex flex-wrap gap-2">
                    {acting === a.employee ? (
                      a.schedule.tranches.map((_, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={a.released.includes(i) ? "outline" : "success"}
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
                          {a.released.includes(i) ? (
                            <>
                              <Check /> Tranche {i}
                            </>
                          ) : (
                            `Release ${i}`
                          )}
                        </Button>
                      ))
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        log in as {short(a.employee)} to release tranches
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="text-primary" />
              Canton Coins held
              <Badge variant="secondary">{coins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coins.length === 0 && (
              <p className="font-mono text-sm text-muted-foreground">
                none visible to acting party
              </p>
            )}
            {coins.map((c) => (
              <CoinRow key={c.contractId} coin={c} acting={acting} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
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
    <Card>
      <CardHeader>
        <CardTitle>Party</CardTitle>
        <CardDescription>
          Acting as a party requires holding its Auth token (issued once, when it's
          allocated in this browser). You can't switch to a party you don't hold
          an auth token for.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label>Acting / viewing as (logged in)</Label>
            <Select
              value={props.acting || undefined}
              onValueChange={props.setActing}
            >
              <SelectTrigger>
                <SelectValue placeholder="— not logged in to any party —" />
              </SelectTrigger>
              <SelectContent>
                {props.loggedInParties.map((party) => (
                  <SelectItem key={party} value={party}>
                    {short(party)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Allocate a new party (hint) — logs you in as it</Label>
            <Input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Company"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                props.onAllocate(hint);
                setHint("");
              }}
            >
              <UserPlus /> Allocate
            </Button>
            <Button variant="outline" onClick={props.onRefresh}>
              <RefreshCw /> Refresh
            </Button>
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          All known parties:{" "}
          {props.parties.map((p) => short(p.party)).join(", ") || "none"}
        </p>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>New vesting proposal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company (signatory)</Label>
            <p className="font-mono text-sm text-muted-foreground">
              {props.actingParty ? short(props.actingParty) : "— log in as a party first —"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Employee (receiver)</Label>
            <PartySelect
              parties={props.parties}
              value={employee}
              onChange={setEmployee}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cliff (seconds)</Label>
            <Input
              type="number"
              value={cliffSeconds}
              onChange={(e) => setCliffSeconds(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tranches (offset seconds / amount)</Label>
          {tranches.map((t, i) => (
            <div className="grid grid-cols-2 gap-3" key={i}>
              <Input
                type="number"
                value={t.offsetSeconds}
                onChange={(e) =>
                  setTranches((ts) =>
                    ts.map((x, j) =>
                      j === i ? { ...x, offsetSeconds: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
              <Input
                value={t.amount}
                onChange={(e) =>
                  setTranches((ts) =>
                    ts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setTranches((ts) => [...ts, { offsetSeconds: 0, amount: "100.0" }])
            }
          >
            <Plus /> tranche
          </Button>
        </div>
        <Button
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
          Create proposal (as {props.actingParty ? short(props.actingParty) : "…"})
        </Button>
      </CardContent>
    </Card>
  );
}

function PartySelect(props: {
  parties: PartyDetails[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={props.value || undefined} onValueChange={props.onChange}>
      <SelectTrigger>
        <SelectValue placeholder="— select —" />
      </SelectTrigger>
      <SelectContent>
        {props.parties.map((p) => (
          <SelectItem key={p.party} value={p.party}>
            {short(p.party)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PartyRow({ company, employee }: { company: string; employee: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <Badge>company</Badge>
      <span className="font-mono text-xs">{short(company)}</span>
      <Badge>employee</Badge>
      <span className="font-mono text-xs">{short(employee)}</span>
    </div>
  );
}

function CoinRow({ coin, acting }: { coin: Coin; acting: string }) {
  const isOwner = acting === coin.owner;
  const isIssuer = acting === coin.issuer;
  // Received (acting is owner) => green; sent (acting is issuer) => red.
  const amountClass = isOwner
    ? "text-green-600 dark:text-green-500"
    : isIssuer
      ? "text-red-600 dark:text-red-500"
      : "text-primary";
  const highlight = "font-semibold text-blue-600 dark:text-blue-400";

  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={`font-mono text-xs ${isIssuer ? highlight : ""}`}>
            {short(coin.issuer)}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className={`font-mono text-xs ${isOwner ? highlight : ""}`}>
            {short(coin.owner)}
          </span>
          <span className={`ml-auto text-lg font-bold ${amountClass}`}>
            {isOwner ? "+" : isIssuer ? "−" : ""}
            {coin.amount}
          </span>
        </div>
        <ContractId id={coin.contractId} />
      </CardContent>
    </Card>
  );
}

function ContractId({ id }: { id: string }) {
  return (
    <div className="break-all font-mono text-xs text-muted-foreground/70">
      {short(id)}
    </div>
  );
}

function ScheduleView({
  schedule,
  released,
}: {
  schedule: Proposal["schedule"];
  released?: number[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-muted-foreground">
        start {schedule.startDate}, cliff {schedule.cliffSeconds}s
      </span>
      {schedule.tranches.map((t, i) => (
        <Badge
          key={i}
          variant={released?.includes(i) ? "success" : "secondary"}
        >
          #{i}: {t.amount} @ {t.offsetSeconds}s{released?.includes(i) ? " ✓" : ""}
        </Badge>
      ))}
    </div>
  );
}

const short = (p: string) => (p.length > 22 ? `${p.slice(0, 12)}…${p.slice(-6)}` : p);

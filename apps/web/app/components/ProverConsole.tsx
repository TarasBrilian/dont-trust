"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RwaProject } from "../../src/lib/data";
import { formatAmount, formatLedger, truncateMiddle } from "../../src/lib/format";
import { CheckIcon, LinkIcon, RefreshIcon, ShieldIcon } from "../../src/lib/icons";

export interface VerifyResult {
  backed: boolean;
  ledger: number;
}

interface Props {
  projects: RwaProject[];
  onVerify: (projectId: string, reserves: number) => VerifyResult;
  /** Called after a real on-chain proof so the dashboard can re-read live status. */
  onRefresh?: () => void | Promise<void>;
}

type Mode = "sim" | "real";

type RunResult = {
  backed: boolean;
  ledger: number;
  reserves: number;
  supply: number;
  unit: string;
  real?: boolean;
  txHash?: string;
  error?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const STEPS = [
  { title: "Attestor signs the reserve set", sub: "EdDSA · BabyJubjub" },
  { title: "Backend builds the witness", sub: "private balances stay server-side" },
  { title: "Generate Groth16 proof", sub: "solvency: Σ reserves ≥ supply" },
  { title: "Verify on Soroban", sub: "pairing check + live supply" },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function ProverConsole({ projects, onVerify, onRefresh }: Props) {
  const [mode, setMode] = useState<Mode>("sim");
  const [selectedId, setSelectedId] = useState<string>("");
  const [reserves, setReserves] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0); // completed steps
  const [failed, setFailed] = useState(false);
  const [failStep, setFailStep] = useState(2); // which step shows the ✕
  const [result, setResult] = useState<RunResult | null>(null);
  const initedRef = useRef(false);

  // Pick a default project + reserves once data arrives.
  useEffect(() => {
    if (initedRef.current || projects.length === 0) return;
    initedRef.current = true;
    const first = projects[0];
    setSelectedId(first.id);
    setReserves(first.backed ? first.supply : Math.round(first.supply * 0.82));
  }, [projects]);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );
  const supply = selected?.supply ?? 0;
  const unit = selected?.unit ?? "";
  const solvent = reserves >= supply && supply > 0;

  function reset() {
    setResult(null);
    setProgress(0);
    setFailed(false);
    setFailStep(2);
  }

  function pick(id: string) {
    const p = projects.find((x) => x.id === id);
    setSelectedId(id);
    setReserves(p ? (p.backed ? p.supply : Math.round(p.supply * 0.82)) : 0);
    reset();
  }

  /** Simulated pipeline (offline demo, interactive tamper). */
  async function runSim() {
    if (!selected || running) return;
    const reduce = prefersReduced();
    const tick = reduce ? 0 : 520;
    const outcome = reserves >= supply;

    setRunning(true);
    reset();

    await wait(tick);
    setProgress(1); // attestor
    await wait(tick);
    setProgress(2); // witness

    if (!outcome) {
      // Proof generation fails at the solvency constraint — exactly the
      // behaviour proven in cargo test / snarkjs. Nothing valid to submit.
      setFailStep(2);
      setFailed(true);
      await wait(reduce ? 0 : 360);
      const r = onVerify(selected.id, reserves);
      setResult({ backed: false, ledger: r.ledger, reserves, supply, unit });
      setRunning(false);
      return;
    }

    await wait(tick);
    setProgress(3); // proof
    await wait(tick);
    setProgress(4); // verify
    const r = onVerify(selected.id, reserves);
    setResult({ backed: true, ledger: r.ledger, reserves, supply, unit });
    setRunning(false);
  }

  /** Real pipeline: the backend runs an actual Groth16 proof + submits on-chain. */
  async function runReal() {
    if (running) return;
    const reduce = prefersReduced();
    const tick = reduce ? 0 : 600;

    setRunning(true);
    reset();

    // Advance the first three steps optimistically while the backend works, then
    // hold "Verify on Soroban" active until the response settles.
    const anim = (async () => {
      await wait(tick);
      setProgress(1);
      await wait(tick);
      setProgress(2);
      await wait(tick);
      setProgress(3);
    })();

    try {
      const res = await fetch(`${API_URL}/verifications/demo`, { method: "POST" });
      await anim;
      if (!res.ok) throw new Error(`backend returned ${res.status}`);
      const data = (await res.json()) as {
        backed: boolean;
        ledger: number;
        txHash: string;
        claimedSupply: string;
      };
      setProgress(4);
      const provedSupply = Number(data.claimedSupply ?? supply);
      setResult({
        backed: !!data.backed,
        ledger: data.ledger ?? 0,
        reserves: provedSupply,
        supply: provedSupply,
        unit: unit || "RWUSD",
        real: true,
        txHash: data.txHash,
      });
      if (data.backed) await onRefresh?.();
    } catch (e) {
      await anim.catch(() => {});
      setFailStep(3); // failed at "Verify on Soroban"
      setFailed(true);
      setResult({
        backed: false,
        ledger: 0,
        reserves: 0,
        supply,
        unit,
        real: true,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(false);
    }
  }

  const run = () => (mode === "real" ? runReal() : runSim());
  const sliderMax = Math.max(1, Math.round(supply * 1.4));
  const realMode = mode === "real";

  return (
    <section className="section rise d2" aria-label="Prover console">
      <div className="section-head">
        <h2 className="section-title">Try it — prover console</h2>
        <div className="mode-toggle" role="group" aria-label="Proof mode">
          <button
            className={`chip ${mode === "sim" ? "chip-on" : ""}`}
            onClick={() => {
              setMode("sim");
              reset();
            }}
            disabled={running}
          >
            Simulated
          </button>
          <button
            className={`chip ${mode === "real" ? "chip-on" : ""}`}
            onClick={() => {
              setMode("real");
              reset();
            }}
            disabled={running}
          >
            Real proof
          </button>
        </div>
      </div>

      <div className="console">
        <div className="console-controls">
          <label className="field">
            <span className="field-k">Project</span>
            <select
              className="select"
              value={selectedId}
              onChange={(e) => pick(e.target.value)}
              disabled={running || projects.length === 0 || realMode}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.symbol} — {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field-k">Circulating supply (public)</span>
            <div className="field-v mono">
              {formatAmount(supply)} <span className="muted">{unit}</span>
            </div>
          </div>

          {realMode ? (
            <div className="field">
              <span className="field-k">Attested reserves (private)</span>
              <div className="field-v mono ok">proven, never revealed</div>
              <p className="console-hint" style={{ marginTop: 8 }}>
                Real mode runs an <strong>actual Groth16 proof</strong> over the
                deployed reserves in the backend and submits it to the verifier on
                testnet. The reserve balances never leave the server.
              </p>
            </div>
          ) : (
            <div className="field">
              <span className="field-k">
                Attested reserves (private — only the sum is proven)
              </span>
              <div className={`field-v mono ${solvent ? "ok" : "bad"}`}>
                {formatAmount(reserves)} <span className="muted">{unit}</span>
              </div>
              <input
                className="slider"
                type="range"
                min={0}
                max={sliderMax}
                step={Math.max(1, Math.round(supply / 100))}
                value={reserves}
                onChange={(e) => {
                  setReserves(Number(e.target.value));
                  reset();
                }}
                disabled={running || !selected}
                aria-label="Attested reserves"
              />
              <div className="quick">
                <button
                  className="chip"
                  onClick={() => {
                    setReserves(Math.round(supply * 0.8));
                    reset();
                  }}
                  disabled={running || !selected}
                >
                  Drop below supply
                </button>
                <button
                  className="chip"
                  onClick={() => {
                    setReserves(supply);
                    reset();
                  }}
                  disabled={running || !selected}
                >
                  Restore full reserves
                </button>
              </div>
            </div>
          )}

          <button
            className="btn run"
            onClick={run}
            disabled={running || (!realMode && !selected)}
          >
            {running ? (
              <>
                <RefreshIcon className="spin" /> Proving…
              </>
            ) : (
              <>
                <ShieldIcon width={16} height={16} />{" "}
                {realMode ? "Run real proof on-chain" : "Generate proof & verify"}
              </>
            )}
          </button>
        </div>

        <div className="console-pipeline">
          <ol className="steps">
            {STEPS.map((s, i) => {
              const isFail = failed && i === failStep;
              const done = !isFail && i < progress;
              const active = running && i === progress && !failed;
              const state = isFail
                ? "fail"
                : done
                  ? "done"
                  : active
                    ? "active"
                    : "idle";
              return (
                <li key={s.title} className={`step ${state}`}>
                  <span className="step-mark" aria-hidden>
                    {state === "done" ? (
                      <CheckIcon width={14} height={14} />
                    ) : state === "fail" ? (
                      "✕"
                    ) : state === "active" ? (
                      <RefreshIcon className="spin" width={13} height={13} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="step-body">
                    <span className="step-title">{s.title}</span>
                    <span className="step-sub">{s.sub}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {result ? (
            <div className={`result ${result.backed ? "ok" : "fail"}`} role="status">
              {result.backed ? (
                <>
                  <CheckIcon width={16} height={16} />
                  <div>
                    <strong>
                      {result.real
                        ? "Verified on-chain — real proof accepted."
                        : "Verified on-chain — fully backed."}
                    </strong>
                    <div className="result-sub">
                      {result.real ? (
                        <>
                          Groth16 proof verified by the Soroban contract at ledger{" "}
                          {formatLedger(result.ledger)}.{" "}
                          {result.txHash ? (
                            <a
                              className="txlink mono"
                              href={`https://stellar.expert/explorer/testnet/tx/${result.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {truncateMiddle(result.txHash)}
                              <LinkIcon width={13} height={13} />
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <>
                          Recorded at ledger {formatLedger(result.ledger)}. Reserves{" "}
                          {formatAmount(result.reserves)} ≥ supply{" "}
                          {formatAmount(result.supply)} {result.unit}.
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <span className="x">✕</span>
                  <div>
                    {result.error ? (
                      <>
                        <strong>Could not run the real proof.</strong>
                        <div className="result-sub">
                          {result.error}. Is the backend running at {API_URL}?
                        </div>
                      </>
                    ) : (
                      <>
                        <strong>Proof rejected — reserves below supply.</strong>
                        <div className="result-sub">
                          {formatAmount(result.reserves)} &lt;{" "}
                          {formatAmount(result.supply)} {result.unit}. The solvency
                          constraint Σ reserves ≥ supply is unsatisfiable, so no
                          valid proof exists to submit.
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="console-hint">
              {realMode
                ? "Real mode — calls the backend to build a witness, generate an actual Groth16 proof, and submit it to the verifier on Stellar testnet."
                : "Demo mode — simulates the real attest → prove → verify pipeline locally. Switch to Real proof to run an actual proof on-chain."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

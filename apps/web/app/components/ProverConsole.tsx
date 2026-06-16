"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RwaProject } from "../../src/lib/mock";
import { formatAmount, formatLedger } from "../../src/lib/format";
import { CheckIcon, RefreshIcon, ShieldIcon } from "../../src/lib/icons";

export interface VerifyResult {
  backed: boolean;
  ledger: number;
}

interface Props {
  projects: RwaProject[];
  onVerify: (projectId: string, reserves: number) => VerifyResult;
}

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

export default function ProverConsole({ projects, onVerify }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [reserves, setReserves] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0); // completed steps
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<
    | { backed: boolean; ledger: number; reserves: number; supply: number; unit: string }
    | null
  >(null);
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

  function pick(id: string) {
    const p = projects.find((x) => x.id === id);
    setSelectedId(id);
    setReserves(p ? (p.backed ? p.supply : Math.round(p.supply * 0.82)) : 0);
    setResult(null);
    setProgress(0);
    setFailed(false);
  }

  async function run() {
    if (!selected || running) return;
    const reduce = prefersReduced();
    const tick = reduce ? 0 : 520;
    const outcome = reserves >= supply;

    setRunning(true);
    setResult(null);
    setFailed(false);
    setProgress(0);

    await wait(tick);
    setProgress(1); // attestor
    await wait(tick);
    setProgress(2); // witness

    if (!outcome) {
      // Proof generation fails at the solvency constraint — exactly the
      // behaviour proven in cargo test / snarkjs. Nothing valid to submit.
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

  const sliderMax = Math.max(1, Math.round(supply * 1.4));

  return (
    <section className="section rise d2" aria-label="Prover console">
      <div className="section-head">
        <h2 className="section-title">Try it — prover console</h2>
        <span className="section-note">Tamper with reserves and watch the proof</span>
      </div>

      <div className="console">
        <div className="console-controls">
          <label className="field">
            <span className="field-k">Project</span>
            <select
              className="select"
              value={selectedId}
              onChange={(e) => pick(e.target.value)}
              disabled={running || projects.length === 0}
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
                setResult(null);
                setProgress(0);
                setFailed(false);
              }}
              disabled={running || !selected}
              aria-label="Attested reserves"
            />
            <div className="quick">
              <button
                className="chip"
                onClick={() => {
                  setReserves(Math.round(supply * 0.8));
                  setResult(null);
                  setProgress(0);
                  setFailed(false);
                }}
                disabled={running || !selected}
              >
                Drop below supply
              </button>
              <button
                className="chip"
                onClick={() => {
                  setReserves(supply);
                  setResult(null);
                  setProgress(0);
                  setFailed(false);
                }}
                disabled={running || !selected}
              >
                Restore full reserves
              </button>
            </div>
          </div>

          <button className="btn run" onClick={run} disabled={running || !selected}>
            {running ? (
              <>
                <RefreshIcon className="spin" /> Proving…
              </>
            ) : (
              <>
                <ShieldIcon width={16} height={16} /> Generate proof &amp; verify
              </>
            )}
          </button>
        </div>

        <div className="console-pipeline">
          <ol className="steps">
            {STEPS.map((s, i) => {
              const isFail = failed && i === 2;
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
                    <strong>Verified on-chain — fully backed.</strong>
                    <div className="result-sub">
                      Recorded at ledger {formatLedger(result.ledger)}. Reserves{" "}
                      {formatAmount(result.reserves)} ≥ supply{" "}
                      {formatAmount(result.supply)} {result.unit}.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <span className="x">✕</span>
                  <div>
                    <strong>Proof rejected — reserves below supply.</strong>
                    <div className="result-sub">
                      {formatAmount(result.reserves)} &lt;{" "}
                      {formatAmount(result.supply)} {result.unit}. The solvency
                      constraint Σ reserves ≥ supply is unsatisfiable, so no valid
                      proof exists to submit.
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="console-hint">
              Demo mode — simulates the real attest → prove → verify pipeline. The
              circuit and on-chain verifier are implemented and tested; live testnet
              submission is in progress.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

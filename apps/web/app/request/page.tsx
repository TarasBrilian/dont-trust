"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRequest } from "../../src/lib/requests";
import { ShieldIcon, LockIcon, CheckIcon } from "../../src/lib/icons";

const ASSET_CLASSES = [
  "Treasury",
  "Gold",
  "Real estate",
  "Private credit",
  "Commodities",
  "Carbon",
  "Other",
];
const NETWORKS = ["Stellar Testnet", "Stellar Mainnet"];
const FREQUENCIES = ["Daily", "Weekly", "Monthly", "On-demand"];

interface FormState {
  tokenContract: string;
  network: string;
  symbol: string;
  claimedSupply: string;
  unit: string;
  issuer: string;
  assetClass: string;
  jurisdiction: string;
  attestorKey: string;
  reserveAccounts: string;
  frequency: string;
  contactName: string;
  contactEmail: string;
}

const initial: FormState = {
  tokenContract: "",
  network: NETWORKS[0],
  symbol: "",
  claimedSupply: "",
  unit: "",
  issuer: "",
  assetClass: ASSET_CLASSES[0],
  jurisdiction: "",
  attestorKey: "",
  reserveAccounts: "8",
  frequency: "Weekly",
  contactName: "",
  contactEmail: "",
};

export default function RequestPage() {
  const router = useRouter();
  const [f, setF] = useState<FormState>(initial);
  const [documents, setDocuments] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof FormState) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!f.tokenContract.trim()) e.tokenContract = "Required";
    if (!f.symbol.trim()) e.symbol = "Required";
    if (!f.claimedSupply || Number(f.claimedSupply) <= 0)
      e.claimedSupply = "Enter a positive amount";
    if (!f.issuer.trim()) e.issuer = "Required";
    if (!f.attestorKey.trim()) e.attestorKey = "Required";
    if (!f.reserveAccounts || Number(f.reserveAccounts) <= 0)
      e.reserveAccounts = "Enter a count";
    if (!f.contactEmail.trim()) e.contactEmail = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail))
      e.contactEmail = "Invalid email";
    return e;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const req = createRequest({
      tokenContract: f.tokenContract.trim(),
      network: f.network,
      symbol: f.symbol.trim().toUpperCase(),
      claimedSupply: Number(f.claimedSupply),
      unit: (f.unit.trim() || f.symbol.trim()).toUpperCase(),
      issuer: f.issuer.trim(),
      assetClass: f.assetClass,
      jurisdiction: f.jurisdiction.trim() || "—",
      attestorKey: f.attestorKey.trim(),
      reserveAccounts: Number(f.reserveAccounts),
      frequency: f.frequency,
      documents,
      contactName: f.contactName.trim() || "—",
      contactEmail: f.contactEmail.trim(),
    });
    router.push(`/requests/${req.id}`);
  }

  return (
    <main className="container narrow">
      <div className="page-head rise d1">
        <h1 className="page-title">Request verification</h1>
        <p className="page-lead">
          Submit your tokenized asset to be verified by zk-pob. We prove your
          reserves cover supply in zero-knowledge — your balances and counterparties
          are never disclosed.
        </p>
      </div>

      <form className="form rise d2" onSubmit={submit} noValidate>
        <fieldset className="form-section">
          <legend>
            <ShieldIcon width={15} height={15} /> On-chain identity
          </legend>
          <div className="form-grid">
            <Field label="Token contract address" error={errors.tokenContract} wide>
              <input
                className="input mono"
                placeholder="C…"
                value={f.tokenContract}
                onChange={set("tokenContract")}
              />
            </Field>
            <Field label="Network">
              <select className="select" value={f.network} onChange={set("network")}>
                {NETWORKS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Symbol" error={errors.symbol}>
              <input
                className="input"
                placeholder="RWUSD"
                value={f.symbol}
                onChange={set("symbol")}
              />
            </Field>
            <Field label="Claimed supply" error={errors.claimedSupply}>
              <input
                className="input mono"
                type="number"
                min={0}
                placeholder="1000000"
                value={f.claimedSupply}
                onChange={set("claimedSupply")}
              />
            </Field>
            <Field label="Unit (optional)">
              <input
                className="input"
                placeholder="defaults to symbol"
                value={f.unit}
                onChange={set("unit")}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Issuer &amp; asset</legend>
          <div className="form-grid">
            <Field label="Issuer / legal entity" error={errors.issuer} wide>
              <input
                className="input"
                placeholder="Acme Capital Ltd."
                value={f.issuer}
                onChange={set("issuer")}
              />
            </Field>
            <Field label="Asset class">
              <select
                className="select"
                value={f.assetClass}
                onChange={set("assetClass")}
              >
                {ASSET_CLASSES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="Jurisdiction">
              <input
                className="input"
                placeholder="Singapore"
                value={f.jurisdiction}
                onChange={set("jurisdiction")}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Attestor setup</legend>
          <div className="form-grid">
            <Field
              label="Attestor public key (BabyJubjub)"
              error={errors.attestorKey}
              wide
            >
              <input
                className="input mono"
                placeholder="0x… ax || ay"
                value={f.attestorKey}
                onChange={set("attestorKey")}
              />
            </Field>
            <Field label="Reserve accounts (N)" error={errors.reserveAccounts}>
              <input
                className="input mono"
                type="number"
                min={1}
                value={f.reserveAccounts}
                onChange={set("reserveAccounts")}
              />
            </Field>
            <Field label="Attestation frequency">
              <select
                className="select"
                value={f.frequency}
                onChange={set("frequency")}
              >
                {FREQUENCIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>
            <LockIcon width={15} height={15} /> Documents &amp; contact
          </legend>
          <div className="form-grid">
            <Field label="Supporting documents" wide>
              <label className="file-drop">
                <input
                  type="file"
                  multiple
                  hidden
                  onChange={(e) =>
                    setDocuments(Array.from(e.target.files ?? []).map((x) => x.name))
                  }
                />
                <span>Click to attach (custodian statements, audits…)</span>
              </label>
              {documents.length > 0 && (
                <ul className="doc-list">
                  {documents.map((d) => (
                    <li key={d}>
                      <CheckIcon width={13} height={13} /> {d}
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            <Field label="Contact name">
              <input
                className="input"
                placeholder="Jane Doe"
                value={f.contactName}
                onChange={set("contactName")}
              />
            </Field>
            <Field label="Contact email" error={errors.contactEmail}>
              <input
                className="input"
                placeholder="jane@issuer.example"
                value={f.contactEmail}
                onChange={set("contactEmail")}
              />
            </Field>
          </div>
        </fieldset>

        <div className="form-actions">
          <p className="form-note">
            <LockIcon width={13} height={13} /> Reserve balances are never part of
            this request — only the proof attests to them.
          </p>
          <button className="btn run" type="submit">
            <ShieldIcon width={16} height={16} /> Submit request
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${wide ? "wide" : ""} ${error ? "has-err" : ""}`}>
      <span className="field-k">{label}</span>
      {children}
      {error && <span className="field-err">{error}</span>}
    </label>
  );
}

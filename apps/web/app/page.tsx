/**
 * Dashboard. Shows public token supply and the on-chain backing badge. Both
 * come from chain reads (lib/chain). Once readBackingStatus is wired, render the
 * green "Fully backed ✓" / red "Not backed" badge from the live status.
 */
export default function Page() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: ".25rem" }}>
        zk-pob — Proof of Backing
      </h1>
      <p style={{ color: "#9aa0a6", marginTop: 0 }}>
        Reserves ≥ supply, verified on-chain, without revealing the book.
      </p>

      <section
        style={{
          marginTop: "2.5rem",
          padding: "1.5rem",
          border: "1px solid #232733",
          borderRadius: 12,
          background: "#11141b",
        }}
      >
        <div style={{ color: "#9aa0a6", fontSize: ".85rem" }}>CIRCULATING SUPPLY</div>
        <div style={{ fontSize: "2rem", fontWeight: 600 }}>— RWUSD</div>

        <div
          style={{
            marginTop: "1.25rem",
            display: "inline-block",
            padding: ".4rem .8rem",
            borderRadius: 999,
            background: "#1c2230",
            color: "#9aa0a6",
            fontSize: ".9rem",
          }}
        >
          ◌ Awaiting on-chain status — wire lib/chain.ts
        </div>
      </section>
    </main>
  );
}

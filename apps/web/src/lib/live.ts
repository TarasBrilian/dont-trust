/**
 * Live (on-chain) data source for the dashboard. With DEC-1 = (a), a project is a
 * deployed {token, verifier} pair. The registry is built from the NEXT_PUBLIC_*
 * deployment ids (written by deploy.sh); each project's backing status is read
 * trustlessly from its own verifier via lib/chain.
 */
import { readSupply, readBackingStatus, latestLedger } from "./chain";
import type { RwaProject, VerificationRow } from "./mock";

interface ProjectConfig {
  id: string;
  symbol: string;
  name: string;
  category: string;
  unit: string;
  tokenId: string;
  verifierId: string;
  reserveAccounts: number;
  attestors: number;
}

/** Deployed projects to read from chain. Empty when no deployment is configured. */
export function liveRegistry(): ProjectConfig[] {
  const tokenId = process.env.NEXT_PUBLIC_TOKEN_ID;
  const verifierId = process.env.NEXT_PUBLIC_VERIFIER_ID;
  if (!tokenId || !verifierId) return [];
  // Single deployed demo project (RWUSD). Add more entries as more pairs deploy.
  return [
    {
      id: "rwusd",
      symbol: "RWUSD",
      name: "Treasury-Backed RW USD",
      category: "Treasury",
      unit: "RWUSD",
      tokenId,
      verifierId,
      reserveAccounts: 8,
      attestors: 1,
    },
  ];
}

async function fetchLiveProjects(): Promise<RwaProject[]> {
  const reg = liveRegistry();
  if (reg.length === 0) return [];
  const ledger = await latestLedger().catch(() => 0);
  return Promise.all(
    reg.map(async (c) => {
      const [supply, status] = await Promise.all([
        readSupply(c.tokenId),
        readBackingStatus(c.verifierId),
      ]);
      return {
        id: c.id,
        symbol: c.symbol,
        name: c.name,
        category: c.category,
        supply: Number(supply),
        unit: c.unit,
        backed: status?.backed ?? false,
        verifiedLedger: ledger,
        verifiedAt: status?.verifiedAt ?? new Date(),
        reserveAccounts: c.reserveAccounts,
        attestors: c.attestors,
        commitment: status?.commitment ?? "—",
      } satisfies RwaProject;
    }),
  );
}

// Short memo so the dashboard's parallel getProjects()/getHistory() calls (and a
// quick refresh) don't double-hit the RPC.
let memo: { at: number; promise: Promise<RwaProject[]> } | null = null;
export function liveProjects(): Promise<RwaProject[]> {
  const now = Date.now();
  if (memo && now - memo.at < 2000) return memo.promise;
  memo = { at: now, promise: fetchLiveProjects() };
  return memo.promise;
}

/**
 * The verifier stores only the LATEST status (no on-chain history without an
 * event indexer — WEB-9), so live history is one row per project derived from its
 * current status. Tx hashes aren't in the status, so they're left empty.
 */
export async function liveHistory(): Promise<VerificationRow[]> {
  const projects = await liveProjects();
  return projects
    .filter((p) => p.commitment !== "—")
    .map((p) => ({
      id: `live-${p.id}`,
      asset: p.symbol,
      at: p.verifiedAt,
      ledger: p.verifiedLedger,
      supply: p.supply,
      unit: p.unit,
      backed: p.backed,
      txHash: "",
    }));
}

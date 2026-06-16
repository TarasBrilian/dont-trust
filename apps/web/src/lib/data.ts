/**
 * Dashboard data source dispatcher. Reads come from chain (live) when a
 * deployment is configured (NEXT_PUBLIC_VERIFIER_ID/TOKEN_ID), or from mock data
 * otherwise / when forced. Set NEXT_PUBLIC_USE_MOCK=1 to force mock for offline
 * demos (WEB-5: "keep lib/mock.ts behind a flag").
 *
 * The UI imports getProjects/getHistory/types from HERE, not from mock directly.
 */
export type { RwaProject, VerificationRow } from "./mock";
export { NETWORK } from "./mock";

import {
  getProjects as mockProjects,
  getHistory as mockHistory,
  type RwaProject,
  type VerificationRow,
} from "./mock";
import { liveProjects, liveHistory, liveRegistry } from "./live";

/** True when the dashboard is reading real on-chain data. Constant per build
 *  (NEXT_PUBLIC_* are inlined), so it's safe to evaluate once. */
export const IS_LIVE =
  process.env.NEXT_PUBLIC_USE_MOCK !== "1" && liveRegistry().length > 0;

/**
 * Live mode shows the real on-chain project(s) FIRST, then a few mock projects as
 * fillers so the grid looks populated for a demo (any mock entry colliding with a
 * live id is dropped). Mock mode shows only mock data.
 */
export async function getProjects(): Promise<RwaProject[]> {
  if (!IS_LIVE) return mockProjects();
  const [live, fillers] = await Promise.all([liveProjects(), mockProjects()]);
  const liveIds = new Set(live.map((p) => p.id));
  return [...live, ...fillers.filter((p) => !liveIds.has(p.id))];
}

export async function getHistory(): Promise<VerificationRow[]> {
  if (!IS_LIVE) return mockHistory();
  const [live, fillers] = await Promise.all([liveHistory(), mockHistory()]);
  const liveAssets = new Set(live.map((r) => r.asset));
  return [...live, ...fillers.filter((r) => !liveAssets.has(r.asset))];
}

/**
 * BN254 point serialization for the Soroban host functions.
 *
 * Layout (matches soroban-sdk crypto::bn254, Ethereum-compatible):
 *   G1 = be(X) || be(Y)                         (64 bytes)
 *   G2 = be(X) || be(Y), each Fp2 = be(c1)||be(c0)  (128 bytes)
 *   Fr / Fp = 32-byte big-endian
 *
 * The G2 c1-before-c0 ordering is the classic snarkjs→Ethereum reversal: snarkjs
 * emits Fp2 coordinates as [c0, c1], the host wants [c1, c0]. Getting this wrong
 * makes pairing_check silently fail (CLAUDE.md "Gotchas"). This is the ONE place
 * that conversion is defined.
 */

/** A field element (decimal string) -> 32-byte big-endian. */
export function feltTo32BE(dec: string): Uint8Array {
  let hex = BigInt(dec).toString(16);
  if (hex.length > 64) throw new Error(`field element too large: ${dec}`);
  hex = hex.padStart(64, "0");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** snarkjs G1 point [x, y, z] (projective; z normalized to 1) -> 64 bytes. */
export function encodeG1(p: string[]): Uint8Array {
  if (p.length < 2) throw new Error("G1 point needs [x, y]");
  return concat([feltTo32BE(p[0]!), feltTo32BE(p[1]!)]);
}

/** snarkjs G2 point [[x0,x1],[y0,y1],[..]] -> 128 bytes, Fp2 as c1||c0. */
export function encodeG2(p: string[][]): Uint8Array {
  if (p.length < 2 || p[0]!.length < 2 || p[1]!.length < 2) {
    throw new Error("G2 point needs [[x0,x1],[y0,y1]]");
  }
  const x = p[0]!; // [c0, c1]
  const y = p[1]!;
  // c1 first, then c0
  return concat([feltTo32BE(x[1]!), feltTo32BE(x[0]!), feltTo32BE(y[1]!), feltTo32BE(y[0]!)]);
}

export interface SnarkjsVk {
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
  nPublic: number;
}

export interface EncodedVk {
  alpha1: Uint8Array; // 64
  beta2: Uint8Array; // 128
  gamma2: Uint8Array; // 128
  delta2: Uint8Array; // 128
  ic: Uint8Array[]; // each 64, length nPublic+1
}

export function encodeVk(vk: SnarkjsVk): EncodedVk {
  return {
    alpha1: encodeG1(vk.vk_alpha_1),
    beta2: encodeG2(vk.vk_beta_2),
    gamma2: encodeG2(vk.vk_gamma_2),
    delta2: encodeG2(vk.vk_delta_2),
    ic: vk.IC.map(encodeG1),
  };
}

export interface SnarkjsProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

export interface EncodedProof {
  a: Uint8Array; // 64
  b: Uint8Array; // 128
  c: Uint8Array; // 64
}

export function encodeProof(proof: SnarkjsProof): EncodedProof {
  return {
    a: encodeG1(proof.pi_a),
    b: encodeG2(proof.pi_b),
    c: encodeG1(proof.pi_c),
  };
}

/** public.json (decimal strings) -> array of 32-byte big-endian signals. */
export function encodePublicSignals(pub: string[]): Uint8Array[] {
  return pub.map(feltTo32BE);
}

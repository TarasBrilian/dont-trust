// circomlibjs ships no type declarations. Minimal ambient types for what we use.
declare module "circomlibjs" {
  // The underlying field/curve objects are dynamically built; typed as `any`
  // intentionally — circomlibjs has no stable public type surface.
  export function buildPoseidon(): Promise<any>;
  export function buildEddsa(): Promise<any>;
}

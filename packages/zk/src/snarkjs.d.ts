// snarkjs ships no type declarations. Minimal ambient types for what we use.
declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
    verify(vk: object, publicSignals: string[], proof: object): Promise<boolean>;
  };
}

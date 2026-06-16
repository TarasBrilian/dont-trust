/**
 * The attestor (custodian/auditor). Holds the BabyJubjub private key, signs the
 * reserve balance set with EdDSA-Poseidon, and emits an Attestation.
 *
 * SECURITY — keep these invariants (CLAUDE.md):
 *  - This process is SEPARATE from apps/api on purpose. The attestor key must
 *    never live in the backend.
 *  - It signs RESERVES only (via the commitment), never claimedSupply. Asset and
 *    liability stay separate.
 *  - tokenId and expiry are bound into the signed message.
 *  - The commitment/msg formulas come from @zk-pob/shared — do not reimplement.
 */
import { buildPoseidon, buildEddsa } from "circomlibjs";
import {
  computeCommitment,
  computeMessage,
  type PoseidonFn,
  type Attestation,
  type ReserveAccount,
} from "@zk-pob/shared";

export class Attestor {
  private constructor(
    private readonly eddsa: any,
    private readonly poseidon: PoseidonFn,
    private readonly F: any,
    private readonly privateKey: Uint8Array,
  ) {}

  /** Build an attestor from a 32-byte BabyJubjub private key. */
  static async create(privateKey: Uint8Array): Promise<Attestor> {
    const eddsa = await buildEddsa();
    const poseidonRaw = await buildPoseidon();
    const F = poseidonRaw.F;
    const poseidon: PoseidonFn = (inputs) => F.toObject(poseidonRaw(inputs));
    return new Attestor(eddsa, poseidon, F, privateKey);
  }

  /** Sign a reserve set for a given token + expiry, returning a full attestation. */
  async attest(
    accounts: ReserveAccount[],
    tokenId: bigint,
    expiry: bigint,
  ): Promise<Attestation> {
    const balances = accounts.map((a) => a.balance);
    const salts = accounts.map((a) => a.salt);

    const commitment = computeCommitment(this.poseidon, balances, salts);
    const msg = computeMessage(this.poseidon, commitment, tokenId, expiry);

    const pubKey = this.eddsa.prv2pub(this.privateKey);
    const signature = this.eddsa.signPoseidon(this.privateKey, this.F.e(msg));

    return {
      accounts,
      commitment,
      tokenId,
      expiry,
      signature: {
        R8x: this.F.toObject(signature.R8[0]),
        R8y: this.F.toObject(signature.R8[1]),
        S: signature.S,
      },
      attestorPublicKey: {
        Ax: this.F.toObject(pubKey[0]),
        Ay: this.F.toObject(pubKey[1]),
      },
    };
  }
}

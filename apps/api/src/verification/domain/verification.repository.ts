/**
 * Repository interface for verification history. Non-authoritative: the frontend
 * reads the *real* backing status from chain. This stores history/metadata only
 * (ARCHITECTURE §2). Domain services depend on the interface, not an ORM.
 */

export interface VerificationRecord {
  id: string;
  attestationId: string;
  commitment: string;
  claimedSupply: string;
  backed: boolean;
  txHash: string | null;
  ledger: number | null;
  verifiedAt: string;
}

export interface IVerificationRepository {
  save(record: VerificationRecord): Promise<VerificationRecord>;
  list(): Promise<VerificationRecord[]>;
  latest(): Promise<VerificationRecord | null>;
}

/** DI token — inject the interface, bind the adapter in the module. */
export const VERIFICATION_REPOSITORY = Symbol("IVerificationRepository");

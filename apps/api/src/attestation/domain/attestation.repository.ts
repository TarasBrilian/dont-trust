/**
 * Repository interface for stored attestation metadata. Domain services depend
 * on THIS interface, never on a concrete ORM (CLAUDE.md "Conventions"). Swap the
 * adapter in app.module to change persistence — no service code changes.
 *
 * Persistence note: we store the commitment, never raw balances (ARCHITECTURE §2).
 */

export interface AttestationRecord {
  id: string;
  commitment: string;
  tokenId: string;
  expiry: string;
  attestorAx: string;
  attestorAy: string;
  createdAt: string;
}

export interface IAttestationRepository {
  save(record: AttestationRecord): Promise<AttestationRecord>;
  findById(id: string): Promise<AttestationRecord | null>;
  list(): Promise<AttestationRecord[]>;
}

/** DI token — inject the interface, bind the adapter in the module. */
export const ATTESTATION_REPOSITORY = Symbol("IAttestationRepository");

import { Injectable } from "@nestjs/common";
import type {
  AttestationRecord,
  IAttestationRepository,
} from "../domain/attestation.repository.js";

/**
 * In-memory adapter for local dev. Replace with a real DB adapter (e.g. Prisma)
 * by binding it to ATTESTATION_REPOSITORY in app.module — services are unaffected.
 */
@Injectable()
export class InMemoryAttestationRepository implements IAttestationRepository {
  private readonly store = new Map<string, AttestationRecord>();

  async save(record: AttestationRecord): Promise<AttestationRecord> {
    this.store.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<AttestationRecord | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<AttestationRecord[]> {
    return [...this.store.values()];
  }
}

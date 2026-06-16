import { Injectable } from "@nestjs/common";
import type {
  VerificationRecord,
  IVerificationRepository,
} from "../domain/verification.repository.js";

/** In-memory adapter for local dev. Swap for a real DB adapter in app.module. */
@Injectable()
export class InMemoryVerificationRepository implements IVerificationRepository {
  private readonly store: VerificationRecord[] = [];

  async save(record: VerificationRecord): Promise<VerificationRecord> {
    this.store.push(record);
    return record;
  }

  async list(): Promise<VerificationRecord[]> {
    return [...this.store];
  }

  async latest(): Promise<VerificationRecord | null> {
    return this.store.at(-1) ?? null;
  }
}

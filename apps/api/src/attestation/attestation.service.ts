import { Inject, Injectable } from "@nestjs/common";
import {
  ATTESTATION_REPOSITORY,
  type AttestationRecord,
  type IAttestationRepository,
} from "./domain/attestation.repository.js";

/** Accepts an attestation from the custodian and persists its (non-secret) metadata. */
@Injectable()
export class AttestationService {
  constructor(
    @Inject(ATTESTATION_REPOSITORY)
    private readonly repo: IAttestationRepository,
  ) {}

  async record(
    input: Omit<AttestationRecord, "id" | "createdAt">,
  ): Promise<AttestationRecord> {
    const record: AttestationRecord = {
      ...input,
      id: cryptoRandomId(),
      createdAt: new Date().toISOString(),
    };
    return this.repo.save(record);
  }

  list(): Promise<AttestationRecord[]> {
    return this.repo.list();
  }
}

function cryptoRandomId(): string {
  return "att_" + Math.random().toString(36).slice(2, 12);
}

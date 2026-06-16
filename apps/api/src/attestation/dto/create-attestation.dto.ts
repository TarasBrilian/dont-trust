import { IsNumberString } from "class-validator";

/**
 * POST /attestations body — non-secret attestation metadata to persist. Never
 * includes raw balances (ARCHITECTURE §2); the commitment stands in for the set.
 */
export class CreateAttestationDto {
  @IsNumberString() commitment!: string;
  @IsNumberString() tokenId!: string;
  @IsNumberString() expiry!: string;
  @IsNumberString() attestorAx!: string;
  @IsNumberString() attestorAy!: string;
}

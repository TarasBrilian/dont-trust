import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsNumberString,
  IsOptional,
  ValidateNested,
} from "class-validator";

/**
 * POST /verifications body — a full attestation (the attestor CLI's output) the
 * backend proves + submits. Field elements arrive as decimal strings (bigints
 * don't survive JSON). The raw balances are used transiently to build the witness
 * and never persisted (ARCHITECTURE §2).
 */
export class AccountDto {
  @IsNumberString() balance!: string;
  @IsNumberString() salt!: string;
}

export class SignatureDto {
  @IsNumberString() R8x!: string;
  @IsNumberString() R8y!: string;
  @IsNumberString() S!: string;
}

export class PublicKeyDto {
  @IsNumberString() Ax!: string;
  @IsNumberString() Ay!: string;
}

export class CreateVerificationDto {
  @ValidateNested({ each: true })
  @Type(() => AccountDto)
  @ArrayMinSize(1)
  accounts!: AccountDto[];

  @ValidateNested()
  @Type(() => SignatureDto)
  signature!: SignatureDto;

  @ValidateNested()
  @Type(() => PublicKeyDto)
  attestorPublicKey!: PublicKeyDto;

  @IsNumberString() commitment!: string;
  @IsNumberString() tokenId!: string;
  @IsNumberString() expiry!: string;

  /** Liability to prove against. Defaults to the live on-chain supply if omitted. */
  @IsOptional()
  @IsNumberString()
  claimedSupply?: string;
}

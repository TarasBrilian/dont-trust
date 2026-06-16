import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { ChainService } from "./chain/chain.service.js";

import { ATTESTATION_REPOSITORY } from "./attestation/domain/attestation.repository.js";
import { InMemoryAttestationRepository } from "./attestation/infrastructure/in-memory-attestation.repository.js";
import { AttestationService } from "./attestation/attestation.service.js";
import { AttestationController } from "./attestation/attestation.controller.js";

import { VERIFICATION_REPOSITORY } from "./verification/domain/verification.repository.js";
import { InMemoryVerificationRepository } from "./verification/infrastructure/in-memory-verification.repository.js";
import { VerificationService } from "./verification/verification.service.js";
import { VerificationController } from "./verification/verification.controller.js";

/**
 * Composition root. Repository interfaces are bound to concrete adapters HERE —
 * swap InMemory* for a real DB adapter without touching any service
 * (CLAUDE.md "Conventions": repository pattern).
 */
@Module({
  // Load apps/api/.env first, then the repo-root .env (where deploy.sh writes the
  // deployment ids + secrets). Earlier files win; already-set process.env wins over both.
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }),
  ],
  controllers: [VerificationController, AttestationController],
  providers: [
    ChainService,
    AttestationService,
    VerificationService,
    { provide: ATTESTATION_REPOSITORY, useClass: InMemoryAttestationRepository },
    { provide: VERIFICATION_REPOSITORY, useClass: InMemoryVerificationRepository },
  ],
})
export class AppModule {}

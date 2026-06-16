import { Body, Controller, Get, Post } from "@nestjs/common";
import { VerificationService } from "./verification.service.js";
import { CreateVerificationDto } from "./dto/create-verification.dto.js";

/**
 * Proving + history. POST builds a witness, runs the real Groth16 prover, and
 * submits to the verifier (write path). GET endpoints serve non-authoritative
 * history — the frontend reads authoritative backing status directly from chain,
 * never through here (ARCHITECTURE §2).
 */
@Controller("verifications")
export class VerificationController {
  constructor(private readonly verifications: VerificationService) {}

  /** Prove + submit a posted attestation. */
  @Post()
  create(@Body() dto: CreateVerificationDto) {
    return this.verifications.proveAndSubmitFromDto(dto);
  }

  /** Prove + submit the server-side demo attestation (drives the prover console). */
  @Post("demo")
  demo() {
    return this.verifications.proveAndSubmitDemo();
  }

  @Get()
  history() {
    return this.verifications.history();
  }

  @Get("latest")
  latest() {
    return this.verifications.latest();
  }
}

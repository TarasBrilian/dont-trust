import { Controller, Get } from "@nestjs/common";
import { VerificationService } from "./verification.service.js";

/**
 * History/metadata endpoints only. The frontend reads authoritative backing
 * status directly from chain — never route that read through here (ARCHITECTURE §2).
 */
@Controller("verifications")
export class VerificationController {
  constructor(private readonly verifications: VerificationService) {}

  @Get()
  history() {
    return this.verifications.history();
  }

  @Get("latest")
  latest() {
    return this.verifications.latest();
  }
}

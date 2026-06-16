import { Body, Controller, Get, Post } from "@nestjs/common";
import { AttestationService } from "./attestation.service.js";
import { CreateAttestationDto } from "./dto/create-attestation.dto.js";

/** Ingest + list attestation metadata (non-secret). */
@Controller("attestations")
export class AttestationController {
  constructor(private readonly attestations: AttestationService) {}

  @Post()
  create(@Body() dto: CreateAttestationDto) {
    return this.attestations.record(dto);
  }

  @Get()
  list() {
    return this.attestations.list();
  }
}

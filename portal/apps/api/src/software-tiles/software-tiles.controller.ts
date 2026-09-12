import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Every logged-in person sees every active tile -- no per-user access control yet.
// Deliberate simplification: real tile-level permissions are deferred to the future Admin
// Master List system per SSO_Portal_Architecture_Decisions.md §6, not improvised here.
@UseGuards(JwtAuthGuard)
@Controller('software-tiles')
export class SoftwareTilesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.softwareTile.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}

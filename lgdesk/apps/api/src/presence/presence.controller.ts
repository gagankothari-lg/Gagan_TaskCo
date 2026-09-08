import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PRESENCE_STATUSES } from './presence.constants';

export class SetPresenceDto {
  // Optional: a bare heartbeat (no status field) just bumps presenceUpdatedAt without
  // changing the caller's stored status. Only present when the user explicitly picks
  // a new status from the dropdown.
  @IsOptional()
  @IsIn(PRESENCE_STATUSES, { message: `status must be one of ${PRESENCE_STATUSES.join(', ')}` })
  status?: string;
}

interface AuthedUser {
  empId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  // Never trust a client-supplied empId -- always the authenticated caller.
  @Patch()
  setStatus(@CurrentUser() user: AuthedUser, @Body() dto: SetPresenceDto) {
    return this.presence.setStatus(user.empId, dto.status);
  }

  @Get()
  getAll() {
    return this.presence.getAll();
  }
}

import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_ROLES } from '../common/constants';

interface AuthedUser {
  empId: string;
}

@Controller('registration')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  // Public -- no auth required (submitted before the applicant has an account).
  @Post()
  submit(@Body() dto: RegisterRequestDto) {
    return this.registration.submitRegistration(dto);
  }

  // Public -- same route shape as LGDesk's GET /auth/team-captain.
  @Get('team-captain')
  async getTeamCaptain(@Query('team') team?: string, @Query('subDept') subDept?: string) {
    const tc = await this.registration.getTeamCaptainByTeam(team, subDept);
    return tc ? { email: tc.email, name: `${tc.firstName} ${tc.lastName}` } : null;
  }

  // Route-level gate is MANAGER_ROLES (not ADMIN_ROLES) so TC/TF can approve within their
  // own scope -- RegistrationService enforces the additive-OR per-request check, matching
  // LGDesk's UsersController exactly.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Get()
  list(@CurrentUser() user: AuthedUser) {
    return this.registration.getRegistrationRequests(user.empId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post(':regId/approve')
  approve(@Param('regId') regId: string, @CurrentUser() user: AuthedUser) {
    return this.registration.approveRegistration(regId, user.empId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post(':regId/reject')
  reject(@Param('regId') regId: string, @CurrentUser() user: AuthedUser, @Body() dto: RejectRegistrationDto) {
    return this.registration.rejectRegistration(regId, user.empId, dto.notes);
  }
}

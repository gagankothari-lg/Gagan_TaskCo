import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegisterRequestDto } from './dto/register-request.dto';

@Controller('registration')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post()
  submit(@Body() dto: RegisterRequestDto) {
    return this.registration.submitRegistration(dto);
  }

  // Same route shape as LGDesk's GET /auth/team-captain -- public, no auth required
  // (called from the registration form before the applicant has an account).
  @Get('team-captain')
  async getTeamCaptain(@Query('team') team?: string, @Query('subDept') subDept?: string) {
    const tc = await this.registration.getTeamCaptainByTeam(team, subDept);
    return tc ? { email: tc.email, name: `${tc.firstName} ${tc.lastName}` } : null;
  }
}

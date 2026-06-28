import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { WorkDurationService } from './work-duration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ADMIN_ROLES, MANAGER_ROLES } from '../common/constants';
import { ClockOutDto } from './dto/clock-out.dto';
import { EditTimeDto } from './dto/edit-time.dto';
import { EditBreakDto } from './dto/edit-break.dto';

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-duration')
export class WorkDurationController {
  constructor(private readonly wd: WorkDurationService) {}

  @Post('clock-in')
  clockIn(@CurrentUser() user: AuthedUser) {
    return this.wd.clockIn(user.empId);
  }

  @Post('clock-out')
  clockOut(@CurrentUser() user: AuthedUser, @Body() dto: ClockOutDto) {
    return this.wd.clockOut(user.empId, dto);
  }

  @Post('break/start')
  startBreak(@CurrentUser() user: AuthedUser) {
    return this.wd.startBreak(user.empId);
  }

  @Post('break/end')
  endBreak(@CurrentUser() user: AuthedUser) {
    return this.wd.endBreak(user.empId);
  }

  @Get('status')
  status(@CurrentUser() user: AuthedUser) {
    return this.wd.getStatus(user.empId);
  }

  @Patch('edit-time')
  editTime(@CurrentUser() user: AuthedUser, @Body() dto: EditTimeDto) {
    return this.wd.editTime(user.empId, dto);
  }

  @Patch('edit-break')
  editBreak(@CurrentUser() user: AuthedUser, @Body() dto: EditBreakDto) {
    return this.wd.editBreak(user.empId, dto);
  }

  @Get('range')
  range(@CurrentUser() user: AuthedUser, @Query('start') start: string, @Query('end') end: string) {
    return this.wd.getWorkDurationsForRange(user.empId, start, end);
  }

  @Roles(...MANAGER_ROLES)
  @Get('team-range')
  teamRange(@CurrentUser() user: AuthedUser, @Query('start') start: string, @Query('end') end: string) {
    return this.wd.getTeamWorkDurationsRange(user.empId, start, end);
  }

  @Roles(...MANAGER_ROLES)
  @Get('team-status')
  teamStatus(@CurrentUser() user: AuthedUser) {
    return this.wd.getTeamClockStatus(user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Post('backfill')
  backfill(@CurrentUser() user: AuthedUser) {
    return this.wd.syncWorkDurationsToWorkLog(user.empId);
  }
}

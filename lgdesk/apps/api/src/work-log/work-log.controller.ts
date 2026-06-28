import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { WorkLogService } from './work-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_ROLES } from '../common/constants';
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { UpdateWorkLogDto } from './dto/update-work-log.dto';
import { CreateInternLogDto } from './dto/create-intern-log.dto';
import { AdminCreateLogDto } from './dto/admin-create-log.dto';

export class SetStatusDto {
  @IsString() @IsNotEmpty({ message: 'status is required' }) status!: string;
}
export class SetCommentDto {
  @IsString() @IsNotEmpty({ message: 'comment is required' }) comment!: string;
}

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-logs')
export class WorkLogController {
  constructor(private readonly workLog: WorkLogService) {}

  @Post()
  submit(@CurrentUser() user: AuthedUser, @Body() dto: CreateWorkLogDto) {
    return this.workLog.submitWorkLog(dto, user.empId);
  }

  @Roles('Intern')
  @Post('intern')
  submitIntern(@CurrentUser() user: AuthedUser, @Body() dto: CreateInternLogDto) {
    return this.workLog.saveInternWorkLog(dto, user.empId);
  }

  @Roles(...MANAGER_ROLES)
  @Post('admin')
  adminSubmit(@CurrentUser() user: AuthedUser, @Body() dto: AdminCreateLogDto) {
    return this.workLog.adminSubmitWorkLog(dto, user.empId);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthedUser, @Query('start') start?: string, @Query('end') end?: string) {
    return this.workLog.getMyWorkLogs(user.empId, start, end);
  }

  @Get('week-summary')
  weekSummary(@CurrentUser() user: AuthedUser, @Query('start') start: string, @Query('end') end: string) {
    return this.workLog.getWeekSummary(user.empId, start, end);
  }

  @Roles(...MANAGER_ROLES)
  @Get('team/overview')
  teamOverview(@CurrentUser() user: AuthedUser, @Query('month') month?: string) {
    return this.workLog.getTeamWorkLogOverview(user.empId, month ?? new Date().toISOString().slice(0, 7));
  }

  @Roles(...MANAGER_ROLES)
  @Get('team')
  team(@CurrentUser() user: AuthedUser, @Query('start') start?: string, @Query('end') end?: string) {
    return this.workLog.getTeamWorkLogs(user.empId, start, end);
  }

  @Roles(...MANAGER_ROLES)
  @Get('member/:empId')
  member(@Param('empId') empId: string, @CurrentUser() user: AuthedUser, @Query('start') start?: string, @Query('end') end?: string) {
    return this.workLog.getMemberWorkLogs(empId, user.empId, start, end);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':empId/:date/status')
  setStatus(@Param('empId') empId: string, @Param('date') date: string, @CurrentUser() user: AuthedUser, @Body() dto: SetStatusDto) {
    return this.workLog.setWorkLogStatus(empId, date, dto.status, user.empId);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':empId/:date/comment')
  setComment(@Param('empId') empId: string, @Param('date') date: string, @CurrentUser() user: AuthedUser, @Body() dto: SetCommentDto) {
    return this.workLog.setWorkLogComment(empId, date, dto.comment, user.empId);
  }

  @Patch(':logId')
  update(@Param('logId') logId: string, @CurrentUser() user: AuthedUser, @Body() dto: UpdateWorkLogDto) {
    return this.workLog.updateWorkLog(logId, dto, user.empId);
  }
}

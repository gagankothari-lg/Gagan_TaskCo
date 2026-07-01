import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ADMIN_ROLES, MANAGER_ROLES } from '../common/constants';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';

interface AuthedUser {
  empId: string;
  role: string;
}

// Empty controller prefix — routes span /leaves, /holidays and /calendar.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Post('leaves')
  submit(@CurrentUser() user: AuthedUser, @Body() dto: CreateLeaveDto) {
    return this.leaves.submitLeave(dto, user.empId);
  }

  @Get('leaves/mine')
  mine(@CurrentUser() user: AuthedUser) {
    return this.leaves.getMyLeaves(user.empId);
  }

  @Delete('leaves/:id')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.leaves.cancelLeave(id, user.empId);
  }

  @Roles(...MANAGER_ROLES)
  @Get('leaves/pending/count')
  pendingCount(@CurrentUser() user: AuthedUser) {
    return this.leaves.getPendingLeaveCount(user.empId);
  }

  @Roles(...MANAGER_ROLES)
  @Get('leaves/pending')
  pending(@CurrentUser() user: AuthedUser) {
    return this.leaves.getPendingLeaves(user.empId);
  }

  @Roles(...MANAGER_ROLES)
  @Patch('leaves/:id/review')
  review(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: ReviewLeaveDto) {
    return this.leaves.reviewLeave(id, dto, user.empId);
  }

  @Get('holidays')
  holidays() {
    return this.leaves.getHolidays();
  }

  @Roles(...ADMIN_ROLES)
  @Post('holidays')
  addHoliday(@CurrentUser() user: AuthedUser, @Body() dto: CreateHolidayDto) {
    return this.leaves.addHoliday(dto, user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('holidays/:id')
  deleteHoliday(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.leaves.deleteHoliday(id, user.empId);
  }

  @Get('calendar')
  calendar(@CurrentUser() user: AuthedUser) {
    return this.leaves.getCalendarData(user.empId);
  }
}

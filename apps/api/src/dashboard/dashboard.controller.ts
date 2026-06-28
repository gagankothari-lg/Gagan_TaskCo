import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ADMIN_ROLES } from '../common/constants';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthedUser) {
    return this.dashboard.getDashboardExtras(user.empId);
  }

  @Get('announcements')
  getAnnouncements(@CurrentUser() user: AuthedUser) {
    return this.dashboard.getAnnouncements(user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Post('announcements')
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateAnnouncementDto) {
    return this.dashboard.createAnnouncement(dto, user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('announcements/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.dashboard.deleteAnnouncement(id, user.empId);
  }
}

import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ProfileUpdatesService } from './profile-updates.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RejectProfileDto } from './dto/reject-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_ROLES } from '../common/constants';

interface AuthedUser {
  empId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('profile-updates')
export class ProfileUpdatesController {
  constructor(private readonly profileUpdates: ProfileUpdatesService) {}

  @Post()
  submit(@CurrentUser() user: AuthedUser, @Body() dto: UpdateProfileDto) {
    return this.profileUpdates.submitProfileUpdate(user.empId, dto);
  }

  // Route-level gate is MANAGER_ROLES (not ADMIN_ROLES) so TC/TF can approve within their
  // own scope -- ProfileUpdatesService enforces the additive-OR per-request check.
  @UseGuards(RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Get()
  list(@CurrentUser() user: AuthedUser) {
    return this.profileUpdates.getPendingProfileRequests(user.empId);
  }

  @UseGuards(RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post(':reqId/approve')
  approve(@Param('reqId') reqId: string, @CurrentUser() user: AuthedUser) {
    return this.profileUpdates.approveProfileUpdate(reqId, user.empId);
  }

  @UseGuards(RolesGuard)
  @Roles(...MANAGER_ROLES)
  @Post(':reqId/reject')
  reject(@Param('reqId') reqId: string, @CurrentUser() user: AuthedUser, @Body() dto: RejectProfileDto) {
    return this.profileUpdates.rejectProfileUpdate(reqId, user.empId, dto.notes);
  }
}

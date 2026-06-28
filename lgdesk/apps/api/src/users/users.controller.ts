import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ADMIN_ROLES, MANAGER_ROLES } from '../common/constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { RejectProfileDto } from './dto/reject-profile.dto';

interface AuthedUser {
  empId: string;
  email: string;
  role: string;
  team?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthedUser) {
    return this.users.getMe(user.empId);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser() user: AuthedUser, @Body() dto: UpdateProfileDto) {
    return this.users.submitProfileUpdate(user.empId, dto);
  }

  @Get('org-tree')
  getOrgTree() {
    return this.users.getOrgTree();
  }

  @Get('team-captain')
  async getTeamCaptain(@Query('team') team?: string, @Query('subDept') subDept?: string) {
    const tc = await this.users.getTeamCaptainByTeam(team, subDept);
    return tc ? { email: tc.email, name: `${tc.firstName} ${tc.lastName}` } : null;
  }

  @Roles(...MANAGER_ROLES)
  @Get('registrations')
  getRegistrations(@CurrentUser() user: AuthedUser) {
    return this.users.getRegistrationRequests(user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('registrations/:reqId/approve')
  approveRegistration(@Param('reqId') reqId: string, @CurrentUser() user: AuthedUser) {
    return this.users.approveRegistration(reqId, user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('registrations/:reqId/reject')
  rejectRegistration(
    @Param('reqId') reqId: string,
    @CurrentUser() user: AuthedUser,
    @Body() dto: RejectRegistrationDto,
  ) {
    return this.users.rejectRegistration(reqId, user.empId, dto.notes);
  }

  @Roles(...MANAGER_ROLES)
  @Get('profile-requests')
  getProfileRequests(@CurrentUser() user: AuthedUser) {
    return this.users.getPendingProfileRequests(user.empId);
  }

  @Roles(...MANAGER_ROLES)
  @Patch('profile-requests/:reqId/approve')
  approveProfile(@Param('reqId') reqId: string, @CurrentUser() user: AuthedUser) {
    return this.users.approveProfileUpdate(reqId, user.empId);
  }

  @Roles(...MANAGER_ROLES)
  @Patch('profile-requests/:reqId/reject')
  rejectProfile(
    @Param('reqId') reqId: string,
    @CurrentUser() user: AuthedUser,
    @Body() dto: RejectProfileDto,
  ) {
    return this.users.rejectProfileUpdate(reqId, user.empId, dto.notes);
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':empId/role')
  changeRole(
    @Param('empId') empId: string,
    @CurrentUser() user: AuthedUser,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.users.changeRole(empId, dto.newRole, user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':empId/deactivate')
  deactivate(@Param('empId') empId: string, @CurrentUser() user: AuthedUser) {
    return this.users.deactivateEmployee(empId, user.empId);
  }

  @Get()
  getAll(@CurrentUser() user: AuthedUser) {
    return this.users.getAll(user.empId);
  }
}

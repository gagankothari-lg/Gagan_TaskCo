import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ADMIN_ROLES } from '../common/constants';
import { ChangeRoleDto } from './dto/change-role.dto';

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

  @Get('org-tree')
  getOrgTree() {
    return this.users.getOrgTree();
  }

  // RBAC matrix Row 19: Admin/SA plus Team Captain (own-team TM/Intern only) — the
  // scope check lives in UsersService.changeRole. Team Facilitator is intentionally
  // excluded here (no TF branch) and cannot change any role.
  @Roles('Super Admin', 'Admin', 'Team Captain')
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

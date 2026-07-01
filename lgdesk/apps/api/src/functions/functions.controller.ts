import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FunctionsService } from './functions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_ROLES } from '../common/constants';
import { CreateFunctionDto } from './dto/create-function.dto';
import { UpdateFunctionDto } from './dto/update-function.dto';

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('functions')
export class FunctionsController {
  constructor(private readonly functions: FunctionsService) {}

  @Get()
  getAll(@CurrentUser() user: AuthedUser, @Query('projId') projId?: string) {
    return this.functions.getAuthorizedFunctions(user.empId, projId);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateFunctionDto) {
    return this.functions.createFunction(dto, user.empId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.functions.getFunctionById(id, user.empId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: UpdateFunctionDto) {
    return this.functions.updateFunction(id, dto, user.empId);
  }

  // RBAC matrix Row 9: managers (TC/TF) may delete within their own team; the
  // team-scope check lives in FunctionsService.canDelete. TM/Intern stay blocked.
  @Roles(...MANAGER_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.functions.deleteFunction(id, user.empId);
  }
}

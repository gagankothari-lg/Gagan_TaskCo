import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_ROLES } from '../common/constants';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  getAll(@CurrentUser() user: AuthedUser) {
    return this.projects.getAuthorizedProjects(user.empId);
  }

  @Get('mine')
  getMine(@CurrentUser() user: AuthedUser) {
    return this.projects.getAuthorizedProjects(user.empId, 'mine');
  }

  @Roles(...MANAGER_ROLES)
  @Get('team')
  getTeam(@CurrentUser() user: AuthedUser) {
    return this.projects.getAuthorizedProjects(user.empId, 'team');
  }

  // 'all' is Admin/SA org-wide by default, but TC/TF may reach this route too
  // (nav shows "All Projects" to every manager) — ProjectsService.getAuthorizedProjects
  // team-scopes the 'all' branch for non-admin callers, mirroring TasksService.
  @Roles(...MANAGER_ROLES)
  @Get('all')
  getAllScope(@CurrentUser() user: AuthedUser) {
    return this.projects.getAuthorizedProjects(user.empId, 'all');
  }

  @Roles(...MANAGER_ROLES)
  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateProjectDto) {
    return this.projects.createProject(dto, user.empId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.projects.getProjectById(id, user.empId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: UpdateProjectDto) {
    return this.projects.updateProject(id, dto, user.empId);
  }

  // RBAC matrix Row 6: managers (TC/TF) may delete within their own team; the
  // team-scope check lives in ProjectsService.canDelete. TM/Intern stay blocked.
  @Roles(...MANAGER_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.projects.deleteProject(id, user.empId);
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ADMIN_ROLES, MANAGER_ROLES } from '../common/constants';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateProgressDto } from './dto/create-progress.dto';

interface AuthedUser {
  empId: string;
  role: string;
  team?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  // ── static routes first (must precede :id) ──
  @Get()
  getAll(@CurrentUser() user: AuthedUser) {
    return this.tasks.getAuthorizedTasks(user.empId);
  }

  @Get('mine')
  getMine(@CurrentUser() user: AuthedUser) {
    return this.tasks.getAuthorizedTasks(user.empId, 'mine');
  }

  @Roles(...MANAGER_ROLES)
  @Get('team')
  getTeam(@CurrentUser() user: AuthedUser) {
    return this.tasks.getAuthorizedTasks(user.empId, 'team');
  }

  @Roles(...ADMIN_ROLES)
  @Get('all')
  getAllScope(@CurrentUser() user: AuthedUser) {
    return this.tasks.getAuthorizedTasks(user.empId, 'all');
  }

  @Get('plan-week')
  getPlanWeek(@CurrentUser() user: AuthedUser, @Query('weekStart') weekStart?: string) {
    return this.tasks.getPlanWeek(user.empId, weekStart);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateTaskDto) {
    return this.tasks.createTask(dto, user.empId);
  }

  // ── dynamic routes ──
  @Get(':id/progress')
  getProgress(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.tasks.getProgressUpdates(id, user.empId);
  }

  @Post(':id/progress')
  addProgress(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: CreateProgressDto) {
    return this.tasks.submitProgressUpdate(id, dto, user.empId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.tasks.getTaskById(id, user.empId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: UpdateTaskDto) {
    return this.tasks.updateTask(id, dto, user.empId);
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.tasks.deleteTask(id, user.empId);
  }
}

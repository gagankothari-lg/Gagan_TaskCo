import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DdrService } from './ddr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

export class CreateDdrDto {
  @IsIn(['Task', 'Project', 'Function'], { message: 'Invalid entityType' })
  entityType!: 'Task' | 'Project' | 'Function';

  @IsString()
  @IsNotEmpty({ message: 'entityId is required' })
  entityId!: string;

  @IsISO8601({}, { message: 'newDueDate must be a valid date' })
  newDueDate!: string;

  @IsString()
  @IsNotEmpty({ message: 'reason is required' })
  reason!: string;
}

export class RejectDdrDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('ddr')
export class DdrController {
  constructor(private readonly ddr: DdrService) {}

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateDdrDto) {
    return this.ddr.createDdr(dto.entityType, dto.entityId, dto.newDueDate, dto.reason, user.empId);
  }

  @Get()
  list(@CurrentUser() user: AuthedUser, @Query('status') status?: string) {
    return this.ddr.getDdrs(user.empId, status);
  }

  @Get('count')
  count(@CurrentUser() user: AuthedUser) {
    return this.ddr.getPendingDdrCount(user.empId);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.ddr.approveDdr(id, user.empId);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: RejectDdrDto) {
    return this.ddr.rejectDdr(id, user.empId, dto.notes);
  }
}

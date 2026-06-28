import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { WeeklySummaryService } from './weekly-summary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GenerateWeeklySummaryDto, SaveWeeklySummaryDto } from './dto/weekly-summary.dto';

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('weekly-summary')
export class WeeklySummaryController {
  constructor(private readonly summaries: WeeklySummaryService) {}

  @Get()
  get(@CurrentUser() user: AuthedUser, @Query('weekStart') weekStart: string) {
    return this.summaries.getWeeklySummary(user.empId, weekStart);
  }

  @Post()
  save(@CurrentUser() user: AuthedUser, @Body() dto: SaveWeeklySummaryDto) {
    return this.summaries.saveWeeklySummary(user.empId, dto.weekStart, dto.bullets);
  }

  @Post('generate')
  generate(@CurrentUser() user: AuthedUser, @Body() dto: GenerateWeeklySummaryDto) {
    return this.summaries.generateMyWeeklySummary(user.empId, dto.weekStart);
  }
}

import { Module } from '@nestjs/common';
import { WeeklySummaryService } from './weekly-summary.service';
import { WeeklySummaryController } from './weekly-summary.controller';

@Module({
  controllers: [WeeklySummaryController],
  providers: [WeeklySummaryService],
  exports: [WeeklySummaryService],
})
export class WeeklySummaryModule {}

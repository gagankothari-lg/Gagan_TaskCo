import { Module } from '@nestjs/common';
import { WorkDurationService } from './work-duration.service';
import { WorkDurationController } from './work-duration.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { CalendarModule } from '../calendar/calendar.module';
import { WorkLogModule } from '../work-log/work-log.module';

@Module({
  // WorkLogModule: the auto-attendance engine (classifyAndSyncWorkLog) lives on
  // WorkLogService -- WorkDurationService's syncWorkLog delegates to it for non-Intern
  // employees so the classification logic and the MANUAL/AUTO attendanceSource guard
  // have exactly one home.
  imports: [CalendarModule, WorkLogModule],
  controllers: [WorkDurationController],
  providers: [WorkDurationService, IdUtilsService],
  exports: [WorkDurationService],
})
export class WorkDurationModule {}

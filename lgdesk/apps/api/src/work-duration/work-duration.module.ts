import { Module } from '@nestjs/common';
import { WorkDurationService } from './work-duration.service';
import { WorkDurationController } from './work-duration.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [WorkDurationController],
  providers: [WorkDurationService, IdUtilsService],
  exports: [WorkDurationService],
})
export class WorkDurationModule {}

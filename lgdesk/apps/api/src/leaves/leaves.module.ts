import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [CalendarModule],
  controllers: [LeavesController],
  providers: [LeavesService, IdUtilsService],
  exports: [LeavesService],
})
export class LeavesModule {}

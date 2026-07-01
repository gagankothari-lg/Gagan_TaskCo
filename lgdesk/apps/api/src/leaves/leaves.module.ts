import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { CalendarModule } from '../calendar/calendar.module';
import { UsersModule } from '../users/users.module';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({
  imports: [CalendarModule, UsersModule, MeetingsModule],
  controllers: [LeavesController],
  providers: [LeavesService, IdUtilsService],
  exports: [LeavesService],
})
export class LeavesModule {}

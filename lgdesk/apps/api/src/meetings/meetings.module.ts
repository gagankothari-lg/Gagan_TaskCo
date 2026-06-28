import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { IdUtilsService } from '../common/utils/id.utils';

@Module({
  controllers: [MeetingsController],
  providers: [MeetingsService, GoogleCalendarService, IdUtilsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}

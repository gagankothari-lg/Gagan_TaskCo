import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { EmailModule } from '../email/email.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [EmailModule, CalendarModule],
  controllers: [UsersController],
  providers: [UsersService, IdUtilsService],
  exports: [UsersService],
})
export class UsersModule {}

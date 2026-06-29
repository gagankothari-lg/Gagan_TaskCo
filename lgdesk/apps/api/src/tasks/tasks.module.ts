import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { UsersModule } from '../users/users.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [UsersModule, CalendarModule],
  controllers: [TasksController],
  providers: [TasksService, IdUtilsService],
  exports: [TasksService],
})
export class TasksModule {}

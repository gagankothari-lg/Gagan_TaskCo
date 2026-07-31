import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { CalendarModule } from '../calendar/calendar.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [CalendarModule, UsersModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, IdUtilsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}

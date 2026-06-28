import { Module } from '@nestjs/common';
import { WorkLogService } from './work-log.service';
import { WorkLogController } from './work-log.controller';
import { IdUtilsService } from '../common/utils/id.utils';

@Module({
  controllers: [WorkLogController],
  providers: [WorkLogService, IdUtilsService],
  exports: [WorkLogService],
})
export class WorkLogModule {}

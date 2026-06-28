import { Module } from '@nestjs/common';
import { FunctionsService } from './functions.service';
import { FunctionsController } from './functions.controller';
import { IdUtilsService } from '../common/utils/id.utils';

@Module({
  controllers: [FunctionsController],
  providers: [FunctionsService, IdUtilsService],
  exports: [FunctionsService],
})
export class FunctionsModule {}

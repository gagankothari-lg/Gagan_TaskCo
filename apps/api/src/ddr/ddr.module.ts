import { Module } from '@nestjs/common';
import { DdrService } from './ddr.service';
import { DdrController } from './ddr.controller';
import { IdUtilsService } from '../common/utils/id.utils';

@Module({
  controllers: [DdrController],
  providers: [DdrService, IdUtilsService],
  exports: [DdrService],
})
export class DdrModule {}

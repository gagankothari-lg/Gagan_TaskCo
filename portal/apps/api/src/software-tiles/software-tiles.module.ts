import { Module } from '@nestjs/common';
import { SoftwareTilesController } from './software-tiles.controller';

@Module({
  controllers: [SoftwareTilesController],
})
export class SoftwareTilesModule {}

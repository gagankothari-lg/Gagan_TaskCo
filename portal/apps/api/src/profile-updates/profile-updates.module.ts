import { Module } from '@nestjs/common';
import { ProfileUpdatesService } from './profile-updates.service';
import { ProfileUpdatesController } from './profile-updates.controller';
import { IdUtilsService } from '../common/utils/id.utils';

@Module({
  controllers: [ProfileUpdatesController],
  providers: [ProfileUpdatesService, IdUtilsService],
})
export class ProfileUpdatesModule {}

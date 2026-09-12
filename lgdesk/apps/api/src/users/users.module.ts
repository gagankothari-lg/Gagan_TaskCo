import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { IdUtilsService } from '../common/utils/id.utils';

@Module({
  controllers: [UsersController],
  providers: [UsersService, IdUtilsService],
  exports: [UsersService],
})
export class UsersModule {}

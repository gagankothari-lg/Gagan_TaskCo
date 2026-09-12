import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for GoogleVerifyService
  controllers: [RegistrationController],
  providers: [RegistrationService, IdUtilsService],
})
export class RegistrationModule {}

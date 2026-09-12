import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { RegistrationController } from './registration.controller';
import { IdUtilsService } from '../common/utils/id.utils';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AuthModule, EmailModule], // AuthModule for GoogleVerifyService/JwtStrategy
  controllers: [RegistrationController],
  providers: [RegistrationService, IdUtilsService],
})
export class RegistrationModule {}

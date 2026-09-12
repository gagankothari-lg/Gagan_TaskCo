import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RegistrationModule } from './registration/registration.module';
import { ProfileUpdatesModule } from './profile-updates/profile-updates.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, RegistrationModule, ProfileUpdatesModule],
  controllers: [HealthController],
})
export class AppModule {}

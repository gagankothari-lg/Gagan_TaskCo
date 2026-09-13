import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../email/email.module';

// Phase 7b: JwtModule/JwtService retired from here -- they only ever backed this
// module's own login() (Portal's job now). JwtStrategy (passport-jwt) reads JWT_SECRET
// directly from process.env for token *validation*, independent of JwtService, so
// PassportModule alone is still all auth guards need.
@Module({
  imports: [EmailModule, PassportModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

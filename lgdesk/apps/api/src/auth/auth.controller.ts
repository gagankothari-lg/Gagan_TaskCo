import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { ResetPasswordConfirmDto } from './dto/reset-password-confirm.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

interface AuthedUser {
  empId: string;
  email: string;
  role: string;
  team?: string;
  jti: string;
  exp: number;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  // I-03: brute-force protection — max 5 login attempts/minute per IP.
  @Throttle({ short: { limit: 5, ttl: 60000 }, medium: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthedUser) {
    return this.auth.getInitialPayload(user.empId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthedUser) {
    return this.auth.logout(user.empId, user.jti, new Date(user.exp * 1000));
  }

  @Throttle({ short: { limit: 5, ttl: 60000 }, medium: { limit: 5, ttl: 60000 } })
  @Post('register/request')
  register(@Body() dto: RegisterRequestDto) {
    return this.users.submitRegistration(dto);
  }

  // I-03: OTP request — max 3 per 5 minutes per IP.
  @Throttle({ short: { limit: 3, ttl: 300000 }, medium: { limit: 3, ttl: 300000 } })
  @Post('password-reset/request')
  requestReset(@Body() dto: ResetPasswordRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Throttle({ short: { limit: 5, ttl: 60000 }, medium: { limit: 5, ttl: 60000 } })
  @Post('password-reset/confirm')
  confirmReset(@Body() dto: ResetPasswordConfirmDto) {
    return this.auth.confirmPasswordReset(dto.email, dto.otp, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthedUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.empId, dto);
  }
}

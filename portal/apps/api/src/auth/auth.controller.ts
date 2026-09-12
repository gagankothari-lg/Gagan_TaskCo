import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
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
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto.idToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthedUser) {
    return this.auth.me(user.empId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthedUser) {
    return this.auth.logout(user.empId, user.jti, new Date(user.exp * 1000));
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthedUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.empId, dto);
  }
}

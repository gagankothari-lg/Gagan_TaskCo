import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err) throw err;
    if (!user) {
      if (info?.name === 'TokenExpiredError') throw new UnauthorizedException('Token expired');
      if (info?.name === 'JsonWebTokenError') throw new UnauthorizedException('Invalid token');
      throw new UnauthorizedException('Unauthorized');
    }
    return user as TUser;
  }
}

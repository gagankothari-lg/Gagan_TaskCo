import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ProfileUpdatesService } from './profile-updates.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthedUser {
  empId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('profile-updates')
export class ProfileUpdatesController {
  constructor(private readonly profileUpdates: ProfileUpdatesService) {}

  @Post()
  submit(@CurrentUser() user: AuthedUser, @Body() dto: UpdateProfileDto) {
    return this.profileUpdates.submitProfileUpdate(user.empId, dto);
  }
}

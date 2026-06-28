import { Controller, Get, UseGuards } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('team')
  team(@CurrentUser() user: AuthedUser) {
    return this.directory.getTeamDirectory(user.empId);
  }

  @Get('company')
  company(@CurrentUser() user: AuthedUser) {
    return this.directory.getCompanyDirectory(user.empId);
  }

  @Get('org-chart')
  orgChart() {
    return this.directory.getOrgChartData();
  }
}

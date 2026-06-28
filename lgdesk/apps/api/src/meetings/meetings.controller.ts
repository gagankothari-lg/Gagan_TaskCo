import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMeetingDto } from './dto/create-meeting.dto';

interface AuthedUser {
  empId: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  getAll(@CurrentUser() user: AuthedUser) {
    return this.meetings.getMeetings(user.empId);
  }

  @Get('upcoming')
  upcoming(@CurrentUser() user: AuthedUser) {
    return this.meetings.getUpcomingMeetings(user.empId);
  }

  @Get('range')
  range(@CurrentUser() user: AuthedUser, @Query('start') start: string, @Query('end') end: string) {
    return this.meetings.getMeetingsForRange(user.empId, start, end);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateMeetingDto) {
    return this.meetings.createMeeting(dto, user.empId);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.meetings.cancelMeeting(id, user.empId);
  }
}

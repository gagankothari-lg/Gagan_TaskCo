import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { UpdateIdeaDto } from './dto/update-idea.dto';

interface AuthedUser {
  empId: string;
}

// Personal data — no @Roles/@RolesGuard. Every authenticated user manages only
// their own ideas (Part 28 BR — no role gating).
@UseGuards(JwtAuthGuard)
@Controller('ideas')
export class IdeasController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  getMine(@CurrentUser() user: AuthedUser) {
    return this.notes.getIdeas(user.empId);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateIdeaDto) {
    return this.notes.createIdea(dto, user.empId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: UpdateIdeaDto) {
    return this.notes.updateIdea(id, dto, user.empId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.notes.deleteIdea(id, user.empId);
  }
}

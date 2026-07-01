import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

interface AuthedUser {
  empId: string;
}

// Personal data — no @Roles/@RolesGuard. Every authenticated user manages only
// their own notes (Part 28 BR — no role gating).
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  getMine(@CurrentUser() user: AuthedUser) {
    return this.notes.getNotes(user.empId);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateNoteDto) {
    return this.notes.createNote(dto, user.empId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: UpdateNoteDto) {
    return this.notes.updateNote(id, dto, user.empId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.notes.deleteNote(id, user.empId);
  }
}

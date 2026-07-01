import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

interface AuthedUser {
  empId: string;
}

// Personal data — no @Roles/@RolesGuard. Every authenticated user manages only
// their own todos (Part 28 BR — no role gating).
@UseGuards(JwtAuthGuard)
@Controller('todos')
export class TodosController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  getMine(@CurrentUser() user: AuthedUser) {
    return this.notes.getTodos(user.empId);
  }

  @Post()
  create(@CurrentUser() user: AuthedUser, @Body() dto: CreateTodoDto) {
    return this.notes.createTodo(dto, user.empId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: AuthedUser, @Body() dto: UpdateTodoDto) {
    return this.notes.updateTodo(id, dto, user.empId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthedUser) {
    return this.notes.deleteTodo(id, user.empId);
  }
}

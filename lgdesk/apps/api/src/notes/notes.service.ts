import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { CreateIdeaDto } from './dto/create-idea.dto';
import { UpdateIdeaDto } from './dto/update-idea.dto';

// Part 28 "Module — Personal Productivity": Todos/Notes/Ideas are per-user
// scratchpad data. No role gating anywhere — every authenticated user manages
// their OWN rows only. empId is always taken from the JWT, never the body,
// and every read/update/delete is scoped to (or ownership-checked against)
// the caller's empId.
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────── todos
  async getTodos(empId: string) {
    return this.prisma.todo.findMany({ where: { empId }, orderBy: { createdAt: 'desc' } });
  }

  async createTodo(dto: CreateTodoDto, empId: string) {
    return this.prisma.todo.create({ data: { empId, title: dto.title } });
  }

  async updateTodo(id: string, dto: UpdateTodoDto, empId: string) {
    await this.requireOwnTodo(id, empId);
    return this.prisma.todo.update({ where: { id }, data: dto });
  }

  async deleteTodo(id: string, empId: string) {
    await this.requireOwnTodo(id, empId);
    await this.prisma.todo.delete({ where: { id } });
    return { ok: true };
  }

  // ─────────────────────────────────────────────── notes
  async getNotes(empId: string) {
    // Pinned notes surface first, matching the Keep-style UI convention.
    return this.prisma.note.findMany({ where: { empId }, orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }] });
  }

  async createNote(dto: CreateNoteDto, empId: string) {
    return this.prisma.note.create({
      data: { empId, title: dto.title, content: dto.content, pinned: dto.pinned ?? false, color: dto.color },
    });
  }

  async updateNote(id: string, dto: UpdateNoteDto, empId: string) {
    await this.requireOwnNote(id, empId);
    return this.prisma.note.update({ where: { id }, data: dto });
  }

  async deleteNote(id: string, empId: string) {
    await this.requireOwnNote(id, empId);
    await this.prisma.note.delete({ where: { id } });
    return { ok: true };
  }

  // ─────────────────────────────────────────────── ideas
  async getIdeas(empId: string) {
    return this.prisma.idea.findMany({ where: { empId }, orderBy: { createdAt: 'desc' } });
  }

  async createIdea(dto: CreateIdeaDto, empId: string) {
    return this.prisma.idea.create({
      data: { empId, title: dto.title, content: dto.content, status: dto.status ?? 'Draft' },
    });
  }

  async updateIdea(id: string, dto: UpdateIdeaDto, empId: string) {
    await this.requireOwnIdea(id, empId);
    return this.prisma.idea.update({ where: { id }, data: dto });
  }

  async deleteIdea(id: string, empId: string) {
    await this.requireOwnIdea(id, empId);
    await this.prisma.idea.delete({ where: { id } });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════ helpers
  private async requireOwnTodo(id: string, empId: string) {
    const row = await this.prisma.todo.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Todo not found');
    if (row.empId !== empId) throw new ForbiddenException();
    return row;
  }

  private async requireOwnNote(id: string, empId: string) {
    const row = await this.prisma.note.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Note not found');
    if (row.empId !== empId) throw new ForbiddenException();
    return row;
  }

  private async requireOwnIdea(id: string, empId: string) {
    const row = await this.prisma.idea.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Idea not found');
    if (row.empId !== empId) throw new ForbiddenException();
    return row;
  }
}

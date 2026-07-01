import { Module } from '@nestjs/common';
import { NotesService } from './notes.service';
import { TodosController } from './todos.controller';
import { NotesController } from './notes.controller';
import { IdeasController } from './ideas.controller';

@Module({
  controllers: [TodosController, NotesController, IdeasController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}

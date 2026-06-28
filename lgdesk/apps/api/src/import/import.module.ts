import { Module } from '@nestjs/common';
import { FunctionsModule } from '../functions/functions.module';
import { TasksModule } from '../tasks/tasks.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [FunctionsModule, TasksModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}

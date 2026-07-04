import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTaskDto } from './create-task.dto';

export class BulkCreateTaskDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  @ArrayMinSize(1, { message: 'tasks must contain at least 1 element' })
  tasks!: CreateTaskDto[];
}

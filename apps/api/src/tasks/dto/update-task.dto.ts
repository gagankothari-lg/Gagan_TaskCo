import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TASK_STATUSES } from '../../common/constants';
import { TASK_PRIORITIES } from './create-task.dto';

// Same fields as CreateTaskDto but all optional. assignerId is never accepted.
export class UpdateTaskDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'title cannot be empty' }) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() projId?: string;
  @IsOptional() @IsString() functionId?: string;
  @IsOptional() @IsString() subFnId?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) assignedTeams?: string[];

  @IsOptional() @IsIn([...TASK_STATUSES], { message: 'Invalid status' }) status?: string;
  @IsOptional() @IsIn([...TASK_PRIORITIES], { message: 'Invalid priority' }) priority?: string;
  @IsOptional() @IsBoolean() recurring?: boolean;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsNumber() estimatedHours?: number;
  @IsOptional() @IsString() fileLink?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) links?: string[];
}

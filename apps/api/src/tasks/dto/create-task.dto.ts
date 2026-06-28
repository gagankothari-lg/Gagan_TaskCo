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

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

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

  // NOTE: assignerId is intentionally absent — it is always set from the JWT, never the body.
}

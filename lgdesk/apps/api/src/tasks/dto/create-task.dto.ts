import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TASK_STATUSES, TASK_RECURRENCE_PATTERNS } from '../../common/constants';

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
  // Round4 checklist#1: real 5-value cadence, replacing the plain-boolean field as the
  // client-writable one. `recurring` (the legacy boolean column) is still kept in sync
  // server-side (tasks.service.ts) for anything else that might read it, but is no longer
  // accepted directly from the client.
  @IsOptional() @IsIn([...TASK_RECURRENCE_PATTERNS], { message: 'Invalid recurrence pattern' }) recurrencePattern?: string;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsOptional() @IsNumber() estimatedHours?: number;
  @IsOptional() @IsString() fileLink?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) links?: string[];

  // NOTE: assignerId is intentionally absent — it is always set from the JWT, never the body.
}

import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { FUNCTION_STATUSES, FUNCTION_RECURRENCE_PATTERNS } from '../../common/constants';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export class CreateFunctionDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() projId?: string;
  @IsOptional() @IsString() parentFnId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) assignedTeams?: string[];
  @IsOptional() @IsIn([...FUNCTION_STATUSES], { message: 'Invalid status' }) status?: string;
  @IsOptional() @IsIn([...PRIORITIES], { message: 'Invalid priority' }) priority?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() deadline?: string;
  // Round4 F35: replaces the old dead boolean field (never backed by a schema column,
  // never read by functions.service.ts) with the real 10-value cadence.
  @IsOptional() @IsIn([...FUNCTION_RECURRENCE_PATTERNS], { message: 'Invalid recurrence pattern' }) recurringPattern?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) links?: string[];

  // NOTE: assignerId and createdById are never accepted — set from the JWT.
}

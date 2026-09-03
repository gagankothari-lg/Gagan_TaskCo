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

// CreateFunctionDto fields, all optional. assignerId/createdById never accepted.
export class UpdateFunctionDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'name cannot be empty' }) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() projId?: string;
  @IsOptional() @IsString() parentFnId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) assignedTeams?: string[];
  @IsOptional() @IsIn([...FUNCTION_STATUSES], { message: 'Invalid status' }) status?: string;
  @IsOptional() @IsIn([...PRIORITIES], { message: 'Invalid priority' }) priority?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() deadline?: string;
  // Round4 F35: see create-function.dto.ts's recurringPattern comment.
  @IsOptional() @IsIn([...FUNCTION_RECURRENCE_PATTERNS], { message: 'Invalid recurrence pattern' }) recurringPattern?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) links?: string[];
}

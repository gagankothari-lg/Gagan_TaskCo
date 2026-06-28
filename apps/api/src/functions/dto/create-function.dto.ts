import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

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
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsIn([...PRIORITIES], { message: 'Invalid priority' }) priority?: string;
  @IsOptional() @IsISO8601() deadline?: string;
  @IsOptional() @IsBoolean() recurringFunctions?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) links?: string[];

  // NOTE: assignerId and createdById are never accepted — set from the JWT.
}

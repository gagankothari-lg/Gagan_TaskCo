import { IsArray, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) assignedTeams?: string[];
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsIn([...PRIORITIES], { message: 'Invalid priority' }) priority?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() deadline?: string;
  @IsOptional() @IsString() parentProjId?: string;

  // NOTE: ownerIds and assignerId are never accepted here — set from the JWT.
}

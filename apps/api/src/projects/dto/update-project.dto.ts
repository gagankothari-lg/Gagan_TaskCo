import { IsArray, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

// CreateProjectDto fields (all optional) + ownerIds. ownerIds is only honored for admins
// (stripped in the service for non-admins). assignerId is never accepted.
export class UpdateProjectDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'name cannot be empty' }) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) assignedTeams?: string[];
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsIn([...PRIORITIES], { message: 'Invalid priority' }) priority?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() deadline?: string;
  @IsOptional() @IsString() parentProjId?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) ownerIds?: string[];
}

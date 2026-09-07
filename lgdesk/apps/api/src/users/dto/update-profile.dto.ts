import { IsOptional, IsString, IsDateString, IsEmail } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  team?: string;

  @IsOptional()
  @IsString()
  subDepartment?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dob must be a valid date' })
  dob?: string;

  // Round5 add'l-2: reference (auth.gs:419-438) treats a manager-change request as one
  // of the 3 approval-gated fields alongside team/subDepartment -- the rebuild had no
  // equivalent at all. Resolved by email (not empId) at approve time, matching
  // approveProfileUpdate's New_Manager_Email -> getEmployeeByEmail lookup.
  @IsOptional()
  @IsEmail({}, { message: 'newManagerEmail must be a valid email' })
  newManagerEmail?: string;
}

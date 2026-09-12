import { IsOptional, IsString, IsDateString, IsEmail } from 'class-validator';

// Same shape as LGDesk's apps/api/src/users/dto/update-profile.dto.ts, re-read fresh.
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

  // Resolved by email (not empId) at approve time (5b), matching LGDesk's
  // approveProfileUpdate's newManagerEmail -> User lookup.
  @IsOptional()
  @IsEmail({}, { message: 'newManagerEmail must be a valid email' })
  newManagerEmail?: string;
}

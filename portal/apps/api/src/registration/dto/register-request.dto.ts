import { IsEmail, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ALL_ROLES } from '../../common/constants';

// Same shape as LGDesk's apps/api/src/auth/dto/register-request.dto.ts, re-read fresh, plus
// an optional googleIdToken for the Google-assisted path (P18 Part 1).
export class RegisterRequestDto {
  @IsNotEmpty({ message: 'firstName is required' })
  @IsString()
  firstName!: string;

  @IsNotEmpty({ message: 'lastName is required' })
  @IsString()
  lastName!: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  // Password minimum is 6 characters, matching LGDesk (Master Reference Part 11) -- still
  // always required even on the Google-assisted path (a password is set either way, per
  // SSO_Portal_Architecture_Decisions.md §5).
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @IsOptional()
  @IsIn([...ALL_ROLES], { message: 'Invalid role' })
  role?: string;

  @IsOptional()
  @IsString()
  team?: string;

  @IsOptional()
  @IsString()
  subDepartment?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid manager email format' })
  managerEmail?: string;

  @IsOptional()
  @IsISO8601()
  dob?: string;

  // Google-assisted registration: the ID token from the "Continue with Google" attempt that
  // returned NO_ACCOUNT. Re-verified server-side; never trusted as-is. Missing/invalid is not
  // a hard failure -- the submission just proceeds as an ordinary manual registration.
  @IsOptional()
  @IsString()
  googleIdToken?: string;
}

import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ALL_ROLES } from '../../common/constants';

export class RegisterRequestDto {
  @IsNotEmpty({ message: 'firstName is required' })
  @IsString()
  firstName!: string;

  @IsNotEmpty({ message: 'lastName is required' })
  @IsString()
  lastName!: string;

  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsString()
  // Master Reference Part 11: password minimum is 6 characters (not 8). Kept in sync
  // with the frontend Zod schemas (min-6) to avoid a client-pass / server-400 mismatch.
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
}

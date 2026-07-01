import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordConfirmDto {
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsNotEmpty({ message: 'otp is required' })
  @IsString()
  otp!: string;

  @IsString()
  // Master Reference Part 11: password minimum is 6 characters (not 8). Kept in sync
  // with the frontend Zod schemas (min-6) to avoid a client-pass / server-400 mismatch.
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword!: string;
}

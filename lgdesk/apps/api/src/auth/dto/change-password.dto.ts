import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'currentPassword is required' })
  @IsString()
  currentPassword!: string;

  @IsString()
  // Master Reference Part 11: password minimum is 6 characters (not 8). Kept in sync
  // with both frontend Zod schemas — the registration form and profile-modal.schema.ts
  // (both min-6) — to avoid a client-pass / server-400 mismatch.
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword!: string;
}

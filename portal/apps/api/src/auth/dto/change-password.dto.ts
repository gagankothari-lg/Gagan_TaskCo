import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'currentPassword is required' })
  @IsString()
  currentPassword!: string;

  @IsString()
  // Password minimum is 6 characters, matching LGDesk (Master Reference Part 11).
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword!: string;
}

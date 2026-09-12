import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  // No MinLength here on purpose, matching LGDesk's LoginDto -- login must reach the
  // credential check for any non-empty password rather than a 400 length error.
  @IsNotEmpty({ message: 'password is required' })
  @IsString()
  password!: string;
}

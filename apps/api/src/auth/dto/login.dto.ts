import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  // NOTE: no MinLength here on purpose — login must reach the credential check
  // for any non-empty password (TC-AUTH-003 logs in with a 7-char password and
  // expects 401 "Invalid credentials", not a 400 length error).
  @IsNotEmpty({ message: 'password is required' })
  @IsString()
  password!: string;
}

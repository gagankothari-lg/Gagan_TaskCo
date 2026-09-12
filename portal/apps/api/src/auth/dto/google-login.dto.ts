import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsNotEmpty({ message: 'idToken is required' })
  @IsString()
  idToken!: string;
}

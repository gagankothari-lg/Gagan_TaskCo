import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

// taskId comes from the route param, not the body.
export class CreateProgressDto {
  @IsString()
  @IsNotEmpty({ message: 'description is required' })
  description!: string;

  @IsOptional() @IsNumber() hoursLogged?: number;
  @IsOptional() @IsString() blockers?: string;
}

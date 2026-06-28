import { IsOptional, IsString } from 'class-validator';

export class ClockOutDto {
  @IsOptional() @IsString() customTime?: string; // 'HH:MM'
  @IsOptional() @IsString() reason?: string;
}

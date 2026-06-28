import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class EditTimeDto {
  @IsString() @IsNotEmpty({ message: 'startTime is required' }) startTime!: string; // 'HH:MM'
  @IsOptional() @IsString() endTime?: string; // 'HH:MM'
  @IsOptional() @IsInt() @Min(0) breakMins?: number;
  @IsString() @IsNotEmpty({ message: 'reason is required' }) reason!: string;
}

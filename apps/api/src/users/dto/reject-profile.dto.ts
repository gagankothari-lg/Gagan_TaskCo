import { IsOptional, IsString } from 'class-validator';

export class RejectProfileDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

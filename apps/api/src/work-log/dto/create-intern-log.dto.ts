import { IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInternLogDto {
  @IsISO8601()
  date!: string;

  @IsOptional() @IsString() attendance?: string; // free-text for interns
  @IsOptional() @IsString() work1stHalf?: string;
  @IsOptional() @IsString() work2ndHalf?: string;
  @IsOptional() @IsNumber() @Min(0) extraHours?: number;
  @IsOptional() @IsString() remark?: string;
}

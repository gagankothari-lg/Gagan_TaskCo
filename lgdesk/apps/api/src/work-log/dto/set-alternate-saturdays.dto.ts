import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, IsString, Matches } from 'class-validator';

export class SetAlternateSaturdaysDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be "YYYY-MM"' })
  month!: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'offDates must contain exactly 2 dates' })
  @ArrayMaxSize(2, { message: 'offDates must contain exactly 2 dates' })
  @IsISO8601({}, { each: true })
  offDates!: string[];
}

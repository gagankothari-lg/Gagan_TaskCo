import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @IsISO8601()
  date!: string;

  // Round4 checklist#6: reference has a description field on Holiday; the rebuild didn't.
  @IsOptional() @IsString() description?: string;
}

import { IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @IsISO8601()
  date!: string;
}

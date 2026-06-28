import { IsArray, IsISO8601, IsString } from 'class-validator';

export class GenerateWeeklySummaryDto {
  @IsISO8601() weekStart!: string;
}

export class SaveWeeklySummaryDto {
  @IsISO8601() weekStart!: string;

  @IsArray()
  @IsString({ each: true })
  bullets!: string[];
}

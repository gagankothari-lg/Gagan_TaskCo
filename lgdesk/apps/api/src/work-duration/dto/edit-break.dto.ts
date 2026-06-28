import { IsInt, Min } from 'class-validator';

export class EditBreakDto {
  @IsInt() @Min(0) breakMins!: number;
}

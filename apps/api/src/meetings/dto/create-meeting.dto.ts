import { IsArray, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

  @IsOptional() @IsString() description?: string;

  @IsISO8601()
  startTime!: string;

  @IsInt() @Min(1) durationMins!: number;

  @IsOptional() @IsString() meetType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) attendeeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) attendeeTeams?: string[];

  // NOTE: creator (organizerId) is set from the JWT, never the body.
}

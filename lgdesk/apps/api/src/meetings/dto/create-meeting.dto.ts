import { IsArray, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

// Master Reference Part 21 "Meeting Templates": Company (SA/Admin only), Team (managers
// only), Custom (any role). 'personal' kept as a legacy alias for 'custom' so any
// not-yet-migrated caller doesn't break.
export const MEETING_TYPES = ['company', 'team', 'custom', 'personal'] as const;

export class CreateMeetingDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

  @IsOptional() @IsString() description?: string;

  @IsISO8601()
  startTime!: string;

  @IsInt() @Min(1) durationMins!: number;

  @IsOptional() @IsIn(MEETING_TYPES) meetType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) attendeeIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) attendeeTeams?: string[];

  // NOTE: creator (organizerId) is set from the JWT, never the body.
}

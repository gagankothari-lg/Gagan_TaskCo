import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VISIBILITY_TYPES, ANNOUNCEMENT_TYPES, ANNOUNCEMENT_PRIORITIES } from '../../common/constants';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsIn([...VISIBILITY_TYPES], { message: 'Invalid visibility' }) visibility?: string;
  // Round4 checklist#7: re-derived from the reference's actual LIVE-reachable markup
  // (index.html #nb-type/#nb-priority selects), overriding the stale Master Reference
  // Part 60 doc.
  @IsOptional() @IsIn([...ANNOUNCEMENT_TYPES], { message: 'Invalid type' }) type?: string;
  @IsOptional() @IsIn([...ANNOUNCEMENT_PRIORITIES], { message: 'Invalid priority' }) priority?: string;
}

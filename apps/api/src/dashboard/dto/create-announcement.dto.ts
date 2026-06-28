import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VISIBILITY_TYPES } from '../../common/constants';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsIn([...VISIBILITY_TYPES], { message: 'Invalid visibility' }) visibility?: string;
}

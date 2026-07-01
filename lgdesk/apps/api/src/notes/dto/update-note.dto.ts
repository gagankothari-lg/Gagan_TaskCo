import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNoteDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsString() color?: string;
}

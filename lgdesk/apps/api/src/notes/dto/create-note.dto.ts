import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateNoteDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  @IsOptional() @IsString() color?: string; // hex or named swatch key — free text (Part 28)

  // empId is never accepted here — always taken from the JWT (@CurrentUser).
}

import { IsOptional, IsString } from 'class-validator';

export class CreateIdeaDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() status?: string; // free text — e.g. Draft/Active/Archived (Part 28)

  // empId is never accepted here — always taken from the JWT (@CurrentUser).
}

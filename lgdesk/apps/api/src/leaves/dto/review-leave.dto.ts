import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewLeaveDto {
  @IsIn(['Approved', 'Rejected'], { message: 'Status must be Approved or Rejected' })
  status!: string;

  @IsOptional() @IsString() notes?: string;
}

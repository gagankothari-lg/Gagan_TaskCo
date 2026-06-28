import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { LEAVE_TYPES } from '../../common/constants';

export class CreateLeaveDto {
  @IsIn([...LEAVE_TYPES], { message: 'Invalid leave type' })
  leaveType!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional() @IsString() reason?: string;
}

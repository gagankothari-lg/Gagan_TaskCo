import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ATTENDANCE_TYPES } from '../../common/constants';

export class CreateWorkLogDto {
  @IsISO8601()
  date!: string;

  @IsOptional() @IsIn([...ATTENDANCE_TYPES], { message: 'Invalid attendance type' }) attendance?: string;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsString() leaveRequested?: string;
  @IsOptional() @IsString() work1stHalf?: string;
  @IsOptional() @IsString() work2ndHalf?: string;
  @IsOptional() @IsNumber() @Min(0) extraHours?: number;
  @IsOptional() @IsString() remark?: string;

  // Manager-only — stripped in the service for non-managers.
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() comments?: string;
}

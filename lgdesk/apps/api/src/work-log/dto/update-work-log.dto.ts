import { IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ATTENDANCE_TYPES } from '../../common/constants';

// All CreateWorkLogDto fields, optional. status/comments are manager-only (stripped in service).
export class UpdateWorkLogDto {
  @IsOptional() @IsISO8601() date?: string;
  @IsOptional() @IsIn([...ATTENDANCE_TYPES], { message: 'Invalid attendance type' }) attendance?: string;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsString() leaveRequested?: string;
  @IsOptional() @IsString() work1stHalf?: string;
  @IsOptional() @IsString() work2ndHalf?: string;
  @IsOptional() @IsNumber() @Min(0) extraHours?: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() comments?: string;
}

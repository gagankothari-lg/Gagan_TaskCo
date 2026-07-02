import { IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdminCreateLogDto {
  @IsString()
  @IsNotEmpty({ message: 'targetEmpId is required' })
  targetEmpId!: string;

  @IsISO8601()
  date!: string;

  // Deliberately NOT @IsIn(ATTENDANCE_TYPES): this single DTO serves both regular
  // employees (fixed 8-value dropdown, enforced client-side) and Interns (free text —
  // e.g. "8.5", "Training" — Part 17 "Intern in Team Log"). Which one applies depends on
  // the *target*'s role, which is only known after a DB lookup in adminSubmitWorkLog(),
  // not at DTO-validation time — so the enum guard can't be applied here without also
  // rejecting legitimate intern free text.
  @IsOptional() @IsString() attendance?: string;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsString() leaveRequested?: string;
  @IsOptional() @IsString() work1stHalf?: string;
  @IsOptional() @IsString() work2ndHalf?: string;
  @IsOptional() @IsNumber() @Min(0) extraHours?: number;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() comments?: string;
}

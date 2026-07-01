import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateTodoDto {
  @IsOptional() @IsString() @IsNotEmpty({ message: 'title cannot be empty' }) title?: string;
  @IsOptional() @IsBoolean() completed?: boolean;
}

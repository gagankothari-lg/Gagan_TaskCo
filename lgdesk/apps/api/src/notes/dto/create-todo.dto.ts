import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTodoDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  title!: string;

  // empId is never accepted here — always taken from the JWT (@CurrentUser).
}

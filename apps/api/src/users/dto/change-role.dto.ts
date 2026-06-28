import { IsIn } from 'class-validator';
import { ALL_ROLES } from '../../common/constants';

export class ChangeRoleDto {
  @IsIn([...ALL_ROLES], { message: 'Invalid role' })
  newRole!: string;
}

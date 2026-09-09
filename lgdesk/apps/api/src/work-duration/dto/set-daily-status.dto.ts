import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { WORK_MODES } from '../../common/constants';

export class SetDailyStatusDto {
  @IsBoolean()
  isWorking!: boolean;

  // Cross-field requirement (required iff isWorking=true, forbidden iff isWorking=false) is
  // enforced in WorkDurationService.setDailyStatus, not here -- it depends on the sibling
  // field's runtime value, not just this field's own shape.
  @IsOptional()
  @IsIn([...WORK_MODES], { message: `workMode must be one of ${WORK_MODES.join(', ')}` })
  workMode?: string;
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdUtilsService } from '../common/utils/id.utils';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idUtils: IdUtilsService,
  ) {}

  // Exactly LGDesk's UsersService.submitProfileUpdate categorization, re-read fresh:
  // designation/firstName/lastName/dob apply immediately (personal/cosmetic, per Round5
  // add'l-2 -- they don't affect how other users' views of the org structure resolve);
  // team/subDepartment/newManagerEmail always queue for approval. Don't invent a different
  // split -- this exact set is what LGDesk's code enforces today.
  private static readonly PROFILE_IMMEDIATE_KEYS = new Set(['designation', 'firstName', 'lastName', 'dob']);

  async submitProfileUpdate(empId: string, dto: UpdateProfileDto) {
    const provided = Object.entries(dto).filter(([, v]) => v !== undefined && v !== null);
    if (provided.length === 0) throw new BadRequestException('No changes provided');

    const immediate = Object.fromEntries(provided.filter(([k]) => ProfileUpdatesService.PROFILE_IMMEDIATE_KEYS.has(k)));
    const queued = Object.fromEntries(provided.filter(([k]) => !ProfileUpdatesService.PROFILE_IMMEDIATE_KEYS.has(k)));

    if (Object.keys(immediate).length > 0) {
      const data: { firstName?: string; lastName?: string; designation?: string; dob?: Date | null } = {};
      if (typeof immediate.firstName === 'string') data.firstName = immediate.firstName;
      if (typeof immediate.lastName === 'string') data.lastName = immediate.lastName;
      if (typeof immediate.designation === 'string') data.designation = immediate.designation;
      if ('dob' in immediate) data.dob = immediate.dob ? new Date(immediate.dob as string) : null;
      await this.prisma.user.update({ where: { empId }, data });
    }

    if (Object.keys(queued).length === 0) return { immediate: true };

    const reqId = await this.idUtils.createWithId('profileUpdateRequest', 'reqId', 'PR', async (id) => {
      await this.prisma.profileUpdateRequest.create({
        data: { reqId: id, empId, changes: JSON.stringify(queued), status: 'Pending' },
      });
      return id;
    });
    return { immediate: false, reqId };
  }
}

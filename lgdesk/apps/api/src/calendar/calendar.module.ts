import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}

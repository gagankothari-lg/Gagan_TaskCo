import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { DdrModule } from './ddr/ddr.module';
import { ProjectsModule } from './projects/projects.module';
import { FunctionsModule } from './functions/functions.module';
import { WorkLogModule } from './work-log/work-log.module';
import { WorkDurationModule } from './work-duration/work-duration.module';
import { LeavesModule } from './leaves/leaves.module';
import { MeetingsModule } from './meetings/meetings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DirectoryModule } from './directory/directory.module';
import { WeeklySummaryModule } from './weekly-summary/weekly-summary.module';
import { ImportModule } from './import/import.module';
import { CalendarModule } from './calendar/calendar.module';
import { NotesModule } from './notes/notes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // I-03 / I-04: global rate limiting (burst + sustained). Auth routes add stricter @Throttle.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60000, limit: 200 },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    TasksModule,
    DdrModule,
    ProjectsModule,
    FunctionsModule,
    WorkLogModule,
    WorkDurationModule,
    LeavesModule,
    MeetingsModule,
    DashboardModule,
    DirectoryModule,
    WeeklySummaryModule,
    ImportModule,
    CalendarModule,
    NotesModule,
  ],
  controllers: [AppController, HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

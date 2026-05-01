/**
 * @module AppModule
 * @description Root module
 *     - : PolicyModule (global)
 *     - : ConfigModule (global, dynamic config engine)
 *     - : AdmissionCounterModule
 *     - : EmailModule (global)
 *     - : GuardiansModule
 *     - : CurriculumTemplatesModule + CurriculumModule
 *     - All academic sub-modules (StreamsModule
 *       wired inside academic.module.ts).
 */

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './common/tenants/tenants.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

// Common (cross-cutting)
import { ActivityModule } from './common/activity/activity.module';
import { ProgressModule } from './common/progress/progress.module';
import { ConfigModule as DynamicConfigModule } from './common/config/config.module';
import { PolicyModule } from './common/policy/policy.module';
import { AdmissionCounterModule } from './common/admission-counter/admission-counter.module';
import { EmailModule } from './common/email/email.module';
import { GuardiansModule } from './common/guardians/guardians.module';

// Domain
import { UsersModule } from './common/users/users.module';
import { SystemModule } from './common/system/system.module';
import { RolesModule } from './common/roles/roles.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AcademicModule } from './academic/academic.module';
import { TeachersModule } from './teachers/teachers.module';
// import { FeesModule } from './fees/fees.module';
import { SettingsModule } from './settings/settings.module';
import { BulkOperationsModule } from './bulk-operations/bulk-operations.module';
import { SchedulersModule } from './schedulers/schedulers.module';
import { CalendarRulesModule } from './common/calendar/calendar-rules.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AttendanceModule } from './attendance/attendance.module';
import { CurriculumTemplatesModule } from './curriculum-templates/curriculum-templates.module';
import { CurriculumModule } from './curriculum/curriculum.module';
import { UploadsModule } from './common/uploads/uploads.module';
import { BackupsModule } from './backups/backups.module';

@Module({
  imports: [
    NestConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    DatabaseModule,
    AuthModule,

    // Cross-cutting (Global)
    ActivityModule,
    ProgressModule,
    DynamicConfigModule,
    PolicyModule,
    AdmissionCounterModule,
    EmailModule,
    GuardiansModule,

    // Domain
    UsersModule,
    TenantsModule,
    SystemModule,
    RolesModule,
    DashboardModule,
    AcademicModule,
    TeachersModule,
    // FeesModule,
    SettingsModule,
    BulkOperationsModule,
    SchedulersModule,
    CalendarRulesModule,
    OnboardingModule,
    AttendanceModule,
    CurriculumTemplatesModule,
    CurriculumModule,

    UploadsModule,
    BackupsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}

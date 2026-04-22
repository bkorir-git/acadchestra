/**
 * @module SchedulersModule
 */
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TermActivationScheduler } from './term-activation.scheduler';
import { FeeReminderScheduler } from './fee-reminder.scheduler';
import { ProgressScheduler } from './progress.scheduler';
import { DatabaseModule } from '../database/database.module';
import { ProgressModule } from '../common/progress/progress.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    ProgressModule,
  ],
  providers: [TermActivationScheduler, FeeReminderScheduler, ProgressScheduler],
})
export class SchedulersModule {}
/**
 * @file students.module.ts
 */
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../../common/activity/activity.module';
import { ConfigModule } from '../../common/config/config.module';
import { GuardiansModule } from '../../common/guardians/guardians.module';
import { AdmissionCounterModule } from '../../common/admission-counter/admission-counter.module';
import { EmailModule } from '../../common/email/email.module';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [
    DatabaseModule,
    EventEmitterModule,
    ActivityModule,
    ConfigModule,
    GuardiansModule,
    AdmissionCounterModule,
    EmailModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}

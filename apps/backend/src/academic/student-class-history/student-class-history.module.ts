/**
 * @module StudentClassHistoryModule
 */
import { Module } from '@nestjs/common';
import { StudentClassHistoryService } from './student-class-history.service';
import { StudentClassHistoryController } from './student-class-history.controller';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../../common/activity/activity.module';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [StudentClassHistoryController],
  providers: [StudentClassHistoryService],
  exports: [StudentClassHistoryService],
})
export class StudentClassHistoryModule {}

import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { ActivityModule } from '../../common/activity/activity.module';
import { StudentClassHistoryModule } from '../student-class-history/student-class-history.module';

@Module({
  imports: [ActivityModule, StudentClassHistoryModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}

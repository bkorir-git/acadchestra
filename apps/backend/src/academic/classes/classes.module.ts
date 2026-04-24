import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../../common/activity/activity.module';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}

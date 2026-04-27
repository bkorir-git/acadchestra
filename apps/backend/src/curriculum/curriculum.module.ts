/**
 * @file curriculum.module.ts
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../common/activity/activity.module';
import { CurriculumService } from './curriculum.service';
import { CurriculumController } from './curriculum.controller';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}

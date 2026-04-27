/**
 * @file curriculum-templates.module.ts
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CurriculumTemplatesService } from './curriculum-templates.service';
import { CurriculumTemplatesController } from './curriculum-templates.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CurriculumTemplatesController],
  providers: [CurriculumTemplatesService],
  exports: [CurriculumTemplatesService],
})
export class CurriculumTemplatesModule {}

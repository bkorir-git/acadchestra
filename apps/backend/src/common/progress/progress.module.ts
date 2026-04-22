/**
 * @module ProgressModule
 */
import { Global, Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}

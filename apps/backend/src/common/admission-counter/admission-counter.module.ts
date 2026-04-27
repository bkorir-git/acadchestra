/**
 * @file admission-counter.module.ts
 * @module common/admission-counter
 * @description Global module exporting the AdmissionCounterService so any
 *   service (Students, BulkImport, Migrations) can inject it.
 */

import { Global, Module } from '@nestjs/common';
import { AdmissionCounterService } from './admission-counter.service';
import { AdmissionCounterController } from './admission-counter.controller';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [AdmissionCounterController],
  providers: [AdmissionCounterService],
  exports: [AdmissionCounterService],
})
export class AdmissionCounterModule {}

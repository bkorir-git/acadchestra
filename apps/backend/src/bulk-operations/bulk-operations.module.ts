/**
 * @module BulkOperationsModule
 */
import { Module } from '@nestjs/common';
import { BulkOperationsService } from './bulk-operations.service';
import { BulkOperationsController } from './bulk-operations.controller';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../common/activity/activity.module';
import { PromotionsModule } from '../academic/promotions/promotions.module';

@Module({
  imports: [DatabaseModule, ActivityModule, PromotionsModule],
  controllers: [BulkOperationsController],
  providers: [BulkOperationsService],
  exports: [BulkOperationsService],
})
export class BulkOperationsModule {}

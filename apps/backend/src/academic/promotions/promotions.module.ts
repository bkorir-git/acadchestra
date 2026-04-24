/**
 * @module PromotionsModule
 * @description Wires single-promotion endpoints + the bulk plan engine.
 */
import { Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { PromotionPlanService } from './promotion-plan.service';
import { PromotionPlanController } from './promotion-plan.controller';
import { PrismaService } from '../../database/prisma.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ActivityModule } from '../../common/activity/activity.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ClassesModule } from '../classes/classes.module';
import { StudentClassHistoryModule } from '../student-class-history/student-class-history.module';

@Module({
  imports: [
    EventEmitterModule,
    ActivityModule,
    NotificationsModule,
    ClassesModule,
    StudentClassHistoryModule,
  ],
  providers: [PromotionsService, PromotionPlanService, PrismaService],
  controllers: [PromotionsController, PromotionPlanController],
  exports: [PromotionsService, PromotionPlanService],
})
export class PromotionsModule {}

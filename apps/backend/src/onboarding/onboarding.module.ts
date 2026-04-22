/**
 * @description Onboarding module — Phase 3.
 *   Registered in AppModule alongside other feature modules.
 *
 *   The DatabaseModule is imported implicitly by PrismaService being
 *   globally provided, but if your project doesn't declare PrismaService as
 *   global, import DatabaseModule.
 *
 * @commit 
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [DatabaseModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
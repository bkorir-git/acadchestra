import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../common/activity/activity.module';
import { ConfigModule } from '../common/config/config.module';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [DatabaseModule, ActivityModule, ConfigModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}

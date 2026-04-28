/**
 * @file guardians.module.ts
 */
import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { ConfigModule } from '../config/config.module';
import { GuardiansService } from './guardians.service';
import { GuardiansController } from './guardians.controller';

@Global()
@Module({
  imports: [DatabaseModule, ActivityModule, ConfigModule],
  controllers: [GuardiansController],
  providers: [GuardiansService],
  exports: [GuardiansService],
})
export class GuardiansModule {}

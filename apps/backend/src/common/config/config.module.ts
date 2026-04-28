/**
 * @file config.module.ts
 * @module common/config
 * @description NestJS module wiring for the Config Engine. Marked Global so
 *   ANY service can inject `ConfigService` without re-importing this module.
 */

import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

/**
 * @file streams.module.ts
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../../common/activity/activity.module';
import { StreamsService } from './streams.service';
import { StreamsController } from './streams.controller';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [StreamsController],
  providers: [StreamsService],
  exports: [StreamsService],
})
export class StreamsModule {}

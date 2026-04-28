/**
 * @module CalendarRulesModule
 * @description Global module providing calendar phase detection + gate rules.
 */
import { Global, Module } from '@nestjs/common';
import { CalendarRulesService } from './calendar-rules.service';
import { CalendarRulesController } from './calendar-rules.controller';
import { DatabaseModule } from '../../database/database.module';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [CalendarRulesController],
  providers: [CalendarRulesService],
  exports: [CalendarRulesService],
})
export class CalendarRulesModule {}

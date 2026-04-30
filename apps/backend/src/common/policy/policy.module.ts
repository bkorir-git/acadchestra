import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PolicyService } from './policy.service';
import { PolicyController } from './policy.controller';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [PolicyController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}

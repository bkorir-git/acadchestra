import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule } from '../../common/config/config.module';
import { AdmissionCounterModule } from '../../common/admission-counter/admission-counter.module';
import { EmailModule } from '../../common/email/email.module';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';

@Module({
  imports: [DatabaseModule, ConfigModule, AdmissionCounterModule, EmailModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}

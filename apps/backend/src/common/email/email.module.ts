/**
 * @file email.module.ts
 * @module common/email
 * @description Global email module. Provider is set at app bootstrap based on
 *   env vars (SMTP / SES / Noop). Templates live in `EmailTemplate` and are
 *   seeded per-tenant by the seed below.
 */

import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { DatabaseModule } from '../../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { SmtpEmailProvider } from './providers/smtp-email-provider';
import { NoopEmailProvider } from './providers/email-provider.interface';
import { seedSystemEmailTemplates } from './seeds/system-email-templates.seed';
import { PrismaService } from '../../database/prisma.service';

@Global()
@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule implements OnModuleInit {
  private readonly logger = new Logger(EmailModule.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Pick provider based on env
    if (process.env.SMTP_HOST) {
      this.emailService.setProvider(new SmtpEmailProvider());
    } else {
      this.emailService.setProvider(new NoopEmailProvider());
    }

    // Idempotently seed system templates
    try {
      await seedSystemEmailTemplates(this.prisma);
    } catch (err: any) {
      this.logger.warn(`System email template seed skipped: ${err?.message}`);
    }
  }
}

/**
 * @file email-provider.interface.ts
 * @module common/email/providers
 * @description Pluggable email provider contract. Implement once per backend
 *   (SMTP, AWS SES, Postmark, SendGrid, Resend) and inject via
 *   `EmailService.setProvider(...)` at app bootstrap.
 *
 *   Why a `NoopEmailProvider`?
 *     - Local dev and tests should NEVER send real emails.
 *     - The noop logs the email + returns a synthetic providerMessageId so
 *       the rest of the pipeline (delivery row, status updates, audit logs)
 *       still exercises end-to-end behaviour.
 */

import { Logger } from '@nestjs/common';

export interface EmailSendInput {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface EmailSendResult {
  providerMessageId?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

/** Logs the email and pretends success. Use in dev/test. */
export class NoopEmailProvider implements EmailProvider {
  readonly name = 'noop';
  private readonly logger = new Logger('NoopEmailProvider');

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    this.logger.log(
      `📧 [NOOP] To: ${input.to} | Subject: ${input.subject} | ${input.body.length} bytes`,
    );
    return { providerMessageId: `noop-${Date.now()}` };
  }
}

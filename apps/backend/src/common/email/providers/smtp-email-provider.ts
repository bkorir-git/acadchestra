/**
 * @file smtp-email-provider.ts
 * @module common/email/providers
 * @description Nodemailer-based SMTP provider. Reads SMTP config from env.
 *   Use this in production when you have direct SMTP access, otherwise pick
 *   SES / Postmark / Resend for higher deliverability.
 *
 *   ENV:
 *     SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE

 */

import { Logger } from '@nestjs/common';
import {
  EmailProvider,
  EmailSendInput,
  EmailSendResult,
} from './email-provider.interface';

// Lazy-import nodemailer so this file compiles even when nodemailer isn't installed.
type Transporter = {
  sendMail: (opts: any) => Promise<{ messageId?: string }>;
};

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor(opts?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    secure?: boolean;
    from?: string;
  }) {
    this.from =
      opts?.from ?? process.env.SMTP_FROM ?? 'noreply@acadchestra.local';

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: opts?.host ?? process.env.SMTP_HOST,
        port: opts?.port ?? Number(process.env.SMTP_PORT ?? 587),
        secure: opts?.secure ?? process.env.SMTP_SECURE === 'true',
        auth: {
          user: opts?.user ?? process.env.SMTP_USER,
          pass: opts?.pass ?? process.env.SMTP_PASS,
        },
      });
    } catch {
      this.logger.warn(
        'nodemailer not installed. SmtpEmailProvider will throw on send().',
      );
    }
  }

  async send(input: EmailSendInput): Promise<EmailSendResult> {
    if (!this.transporter) {
      throw new Error(
        'SMTP transporter not configured (install nodemailer + set SMTP_* env)',
      );
    }
    const result = await this.transporter.sendMail({
      from: this.from,
      to: input.toName ? `"${input.toName}" <${input.to}>` : input.to,
      subject: input.subject,
      [input.isHtml ? 'html' : 'text']: input.body,
    });
    return { providerMessageId: result.messageId };
  }
}

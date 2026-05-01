/**
 * @file email.service.ts
 * @module common/email
 * @description Provider-agnostic email helper. Renders templates with mustache
 *   placeholders, persists every send to `EmailDelivery` for audit, and
 *   delegates the actual transport to a pluggable provider (SMTP, SES, Postmark).
 *
 *   Why a helper service?
 *     - Every onboarding flow, password reset, fee reminder, and welcome email
 *       hits the same path: pick template → fill variables → send → log.
 *     - Repeating that logic in N services is the "Don't Repeat Yourself" sin.
 *
 *   Built-in templates (auto-seeded for every tenant on bootstrap):
 *     - 'welcome'              → Sent to bootstrap admin
 *     - 'password_reset'       → Sent on /auth/forgot-password
 *     - 'temp_password'        → Sent when superadmin generates one
 *     - 'fee_reminder'         → Sent before due date
 *     - 'fee_overdue'          → Sent after due date
 *     - 'term_starting'        → Broadcast to admins
 *     - 'guardian_invite'      → Sent to a parent/guardian
 *     - 'student_admitted'     → Sent to primary guardian after admission
 *
 *   Sending strategies:
 *     - sendNow(...)        → render + persist + dispatch immediately
 *     - queue(...)          → render + persist as QUEUED; processed by scheduler
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmailStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  EmailProvider,
  NoopEmailProvider,
} from './providers/email-provider.interface';
import { renderTemplate } from './template-renderer';
import { ActivityService } from '../activity/activity.service';

interface SendOptions {
  to: string;
  toName?: string;
  templateCode: string;
  variables?: Record<string, unknown>;
  tenantId?: string;
  /** If true, persist as QUEUED. If false, dispatch immediately. */
  queueOnly?: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private provider: EmailProvider = new NoopEmailProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** Replace the email provider at runtime (e.g. SMTP, SES). */
  setProvider(provider: EmailProvider) {
    this.provider = provider;
    this.logger.log(`Email provider set: ${provider.name}`);
  }

  // ─────────────────────────────────────────── PUBLIC API

  /**
   * High-level send. Resolves template, renders, persists, dispatches.
   */
  async send(opts: SendOptions): Promise<{ id: string; status: EmailStatus }> {
    const tpl = await this.resolveTemplate(opts.templateCode, opts.tenantId);
    if (!tpl)
      throw new NotFoundException(
        `Email template "${opts.templateCode}" not found`,
      );

    const subject = renderTemplate(tpl.subject, opts.variables ?? {});
    const body = renderTemplate(tpl.body, opts.variables ?? {});

    // Persist QUEUED first
    const delivery = await this.prisma.emailDelivery.create({
      data: {
        toEmail: opts.to,
        toName: opts.toName,
        subject,
        bodySnapshot: body,
        templateId: tpl.id,
        tenantId: opts.tenantId ?? null,
        status: EmailStatus.QUEUED,
        context: (opts.variables ?? {}) as Prisma.InputJsonValue,
      },
    });

    if (opts.queueOnly) return { id: delivery.id, status: EmailStatus.QUEUED };

    // Dispatch
    try {
      const result = await this.provider.send({
        to: opts.to,
        toName: opts.toName,
        subject,
        body,
        isHtml: tpl.isHtml,
      });
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
        },
      });
      if (opts.tenantId) {
        await this.activity.log({
          action: 'EMAIL_SENT' as any,
          entityType: 'EMAIL_DELIVERY' as any,
          entityId: delivery.id,
          tenantId: opts.tenantId,
          message: `Email "${opts.templateCode}" sent to ${opts.to}`,
          metadata: {
            template: opts.templateCode,
            providerMessageId: result.providerMessageId,
          },
        });
      }
      return { id: delivery.id, status: EmailStatus.SENT };
    } catch (err: any) {
      this.logger.error(`Email dispatch failed: ${err?.message}`, err?.stack);
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: err?.message?.slice(0, 500),
        },
      });
      return { id: delivery.id, status: EmailStatus.FAILED };
    }
  }

  /** Send a custom one-off email without a template. Still persisted. */
  async sendRaw(
    to: string,
    subject: string,
    body: string,
    opts?: { tenantId?: string; isHtml?: boolean; toName?: string },
  ) {
    const delivery = await this.prisma.emailDelivery.create({
      data: {
        toEmail: to,
        toName: opts?.toName,
        subject,
        bodySnapshot: body,
        tenantId: opts?.tenantId ?? null,
        status: EmailStatus.QUEUED,
      },
    });
    try {
      const result = await this.provider.send({
        to,
        toName: opts?.toName,
        subject,
        body,
        isHtml: opts?.isHtml ?? true,
      });
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.providerMessageId,
        },
      });
      return { id: delivery.id, status: EmailStatus.SENT };
    } catch (err: any) {
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: err?.message?.slice(0, 500),
        },
      });
      return { id: delivery.id, status: EmailStatus.FAILED };
    }
  }

  /** Background processor — picks QUEUED rows and dispatches. */
  async processQueue(limit = 50) {
    const due = await this.prisma.emailDelivery.findMany({
      where: { status: EmailStatus.QUEUED },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: { template: true },
    });
    let sent = 0;
    let failed = 0;
    for (const d of due) {
      try {
        const r = await this.provider.send({
          to: d.toEmail,
          toName: d.toName ?? undefined,
          subject: d.subject,
          body: d.bodySnapshot,
          isHtml: d.template?.isHtml ?? true,
        });
        await this.prisma.emailDelivery.update({
          where: { id: d.id },
          data: {
            status: EmailStatus.SENT,
            sentAt: new Date(),
            providerMessageId: r.providerMessageId,
          },
        });
        sent++;
      } catch (err: any) {
        await this.prisma.emailDelivery.update({
          where: { id: d.id },
          data: {
            status: EmailStatus.FAILED,
            errorMessage: err?.message?.slice(0, 500),
          },
        });
        failed++;
      }
    }
    return { processed: due.length, sent, failed };
  }

  // ─────────────────────────────────────────── TEMPLATE RESOLUTION

  /**
   * Resolution order: tenant template by code → system template by code (tenantId IS NULL).
   * This lets schools override defaults without losing the system fallback.
   */
  async resolveTemplate(code: string, tenantId?: string) {
    if (tenantId) {
      const t = await this.prisma.emailTemplate.findFirst({
        where: { code, tenantId, isActive: true },
      });
      if (t) return t;
    }
    return this.prisma.emailTemplate.findFirst({
      where: { code, tenantId: null, isActive: true, isSystem: true },
    });
  }
}

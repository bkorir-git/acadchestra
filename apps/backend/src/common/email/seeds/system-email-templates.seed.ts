/**
 * @file system-email-templates.seed.ts
 * @module common/email/seeds
 * @description Idempotently seeds the system-default email templates with
 *   `tenantId = null` and `isSystem = true`. Tenants can override individual
 *   templates by creating their own row with `tenantId = <theirId>`.
 *
 *   Variables use `{{ dotted.path | filter }}` syntax. See template-renderer.ts.
 */

import { PrismaClient } from '@prisma/client';

interface SystemTemplateSeed {
  code: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  isHtml: boolean;
}

export const SYSTEM_EMAIL_TEMPLATES: SystemTemplateSeed[] = [
  {
    code: 'welcome',
    name: 'Welcome to Acadchestra',
    description: 'Sent to the bootstrap admin when a school is created.',
    subject: 'Welcome to {{ tenant.name }} on Acadchestra',
    isHtml: true,
    body: `<!doctype html>
<html><body style="font-family:system-ui;padding:24px;color:#111">
  <h1 style="color:#3b82f6">Welcome, {{ user.firstName }}!</h1>
  <p>Your school <strong>{{ tenant.name }}</strong> is now live on Acadchestra.</p>
  <p>Sign in here: <a href="{{ links.login }}">{{ links.login }}</a></p>
  <p><strong>Email:</strong> {{ user.email }}<br/>
     <strong>Temporary Password:</strong> <code>{{ user.temporaryPassword }}</code></p>
  <p>You'll be asked to change it on first login.</p>
  <hr/>
  <p style="color:#888;font-size:12px">
    Acadchestra · Orchestrating Education Excellence
  </p>
</body></html>`,
  },

  {
    code: 'temp_password',
    name: 'Temporary Password',
    description: 'Sent when a SuperAdmin generates a fresh temp password.',
    subject: 'Your temporary password for {{ tenant.name }}',
    isHtml: true,
    body: `<p>Hi {{ user.firstName }},</p>
<p>Your administrator has issued a new temporary password for your account at <strong>{{ tenant.name }}</strong>.</p>
<p><strong>Email:</strong> {{ user.email }}<br/>
   <strong>Temporary Password:</strong> <code>{{ user.temporaryPassword }}</code></p>
<p>Sign in at <a href="{{ links.login }}">{{ links.login }}</a> and change it immediately.</p>`,
  },

  {
    code: 'password_reset',
    name: 'Password Reset Request',
    description: 'Sent when a user requests a password reset.',
    subject: 'Reset your {{ tenant.name }} password',
    isHtml: true,
    body: `<p>Hi {{ user.firstName }},</p>
<p>We received a request to reset your password.</p>
<p><a href="{{ links.reset }}">Click here to set a new password</a> (link expires in {{ expiresIn }}).</p>
<p>If you didn't request this, ignore this email — your password is unchanged.</p>`,
  },

  {
    code: 'fee_reminder',
    name: 'Fee Reminder',
    description: 'Sent before a student fee due date.',
    subject: 'Reminder: {{ amount }} due on {{ dueDate }}',
    isHtml: true,
    body: `<p>Dear {{ guardian.name | title }},</p>
<p>This is a reminder that <strong>{{ student.firstName }} {{ student.lastName }}</strong>
   has a fee balance of <strong>{{ amount }}</strong> due on <strong>{{ dueDate }}</strong>.</p>
<p>Pay online or visit the school office to settle.</p>
<p>Thank you,<br/>{{ tenant.name }}</p>`,
  },

  {
    code: 'fee_overdue',
    name: 'Fee Overdue Notice',
    description: 'Sent after a student fee due date passes.',
    subject: "Overdue: {{ student.firstName }}'s fees",
    isHtml: true,
    body: `<p>Dear {{ guardian.name | title }},</p>
<p>The fee balance of <strong>{{ amount }}</strong> for
   <strong>{{ student.firstName }} {{ student.lastName }}</strong>
   was due on <strong>{{ dueDate }}</strong> and is now <strong>{{ daysOverdue }} day(s) overdue</strong>.</p>
<p>Late charges may apply. Please settle as soon as possible.</p>`,
  },

  {
    code: 'student_admitted',
    name: 'Admission Confirmation',
    description: 'Sent to the primary guardian after a student is admitted.',
    subject: 'Welcome to {{ tenant.name }} — Admission Confirmed',
    isHtml: true,
    body: `<p>Dear {{ guardian.name | title }},</p>
<p>We're delighted to confirm the admission of
   <strong>{{ student.firstName }} {{ student.lastName }}</strong>
   to <strong>{{ tenant.name }}</strong>.</p>
<ul>
  <li><strong>Admission Number:</strong> {{ student.admissionNumber }}</li>
  <li><strong>Class:</strong> {{ class.name }}{{#stream}} · Stream {{ stream.name }}{{/stream}}</li>
  <li><strong>Admission Date:</strong> {{ student.admissionDate }}</li>
</ul>
<p>You'll receive further communication about orientation, fees, and the academic calendar.</p>`,
  },

  {
    code: 'guardian_invite',
    name: 'Guardian Portal Invite',
    description: 'Sent to a guardian when invited to the parent portal.',
    subject: "You've been invited to {{ tenant.name }} parent portal",
    isHtml: true,
    body: `<p>Hi {{ guardian.firstName }},</p>
<p>You've been invited to the parent portal at <strong>{{ tenant.name }}</strong>
   so you can view {{ student.firstName }}'s grades, attendance, and fees.</p>
<p>Set up your account here: <a href="{{ links.invite }}">{{ links.invite }}</a></p>
<p>(Link expires in {{ expiresIn }}.)</p>`,
  },

  {
    code: 'term_starting',
    name: 'Term Starting',
    description: 'Broadcast to admins when a term is about to start.',
    subject: '{{ term.name }} starts on {{ term.startDate }}',
    isHtml: true,
    body: `<p>Hi {{ user.firstName }},</p>
<p><strong>{{ term.name }}</strong> at {{ tenant.name }} starts in
   <strong>{{ daysUntilStart }} day(s)</strong> on
   <strong>{{ term.startDate }}</strong>.</p>
<p>Activate it from the academic dashboard to start billing and registers.</p>`,
  },
];

export async function seedSystemEmailTemplates(prisma: PrismaClient) {
  for (const tpl of SYSTEM_EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { tenantId: null, code: tpl.code },
    });

    if (existing) {
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: {
          name: tpl.name,
          description: tpl.description,
          subject: tpl.subject,
          body: tpl.body,
          isHtml: tpl.isHtml,
        },
      });
    } else {
      await prisma.emailTemplate.create({
        data: {
          code: tpl.code,
          name: tpl.name,
          description: tpl.description,
          subject: tpl.subject,
          body: tpl.body,
          isHtml: tpl.isHtml,
          isActive: true,
          isSystem: true,
          tenantId: null,
        },
      });
    }
  }
}

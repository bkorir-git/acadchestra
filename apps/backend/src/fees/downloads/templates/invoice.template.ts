/**
 * @file invoice.template.ts
 * @description Renders an Invoice into HTML for Puppeteer. Mirrors the
 *   StudentFee components and shows paid / pending breakdown.
 */

import { html, layout } from './_layout';
import { formatMoney, CurrencyContext } from '../../common/currency.util';

export interface InvoiceTemplateInput {
  invoice: any;
  tenant: any;
  currency: Partial<CurrencyContext>;
}

export function invoiceTemplate(input: InvoiceTemplateInput): string {
  const { invoice, tenant, currency } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const primary = tenant?.settings?.primaryColor ?? '#1E40AF';
  const sf = invoice.studentFee;
  const student = invoice.student;

  const rows = (sf?.components ?? [])
    .map(
      (c: any, i: number) => `<tr>
      <td>${i + 1}</td>
      <td><b>${html(c.name)}</b></td>
      <td class="right">${fmt(c.amount)}</td>
      <td class="right">${fmt(c.paidAmount ?? 0)}</td>
      <td class="right">${fmt((c.amount ?? 0) - (c.paidAmount ?? 0))}</td>
      <td><span class="badge ${String(c.status).toLowerCase()}">${html(c.status)}</span></td>
    </tr>`,
    )
    .join('');

  const body = `
    <div class="row between">
      <div>
        <h1 class="accent">Invoice</h1>
        <div class="muted">#${html(invoice.invoiceNumber)}</div>
      </div>
      <div class="right">
        <div class="kv"><span class="k">Issued:</span> <span class="v">${new Date(invoice.issueDate).toLocaleDateString()}</span></div>
        ${invoice.dueDate ? `<div class="kv"><span class="k">Due:</span> <span class="v">${new Date(invoice.dueDate).toLocaleDateString()}</span></div>` : ''}
        <div class="kv"><span class="k">Status:</span> <span class="badge ${String(invoice.status).toLowerCase()}">${html(invoice.status)}</span></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:8px;">
      <div>
        <h3>Bill To</h3>
        <div><b>${html(`${student?.firstName ?? ''} ${student?.lastName ?? ''}`)}</b></div>
        <div class="small muted">Adm #${html(student?.admissionNumber ?? '')}</div>
        ${student?.class ? `<div class="small muted">${html(student.class.name)}</div>` : ''}
        ${student?.email ? `<div class="small muted">${html(student.email)}</div>` : ''}
        ${student?.phone ? `<div class="small muted">${html(student.phone)}</div>` : ''}
      </div>
      <div>
        <h3>Fee</h3>
        <div>${html(invoice.feeStructure?.name ?? '')}</div>
        ${invoice.academicTerm ? `<div class="small muted">${html(invoice.academicTerm.name)}</div>` : ''}
        ${invoice.academicYear ? `<div class="small muted">${html(invoice.academicYear.name)}</div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr><th>#</th><th>Item</th><th class="right">Amount</th><th class="right">Paid</th><th class="right">Balance</th><th>Status</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2">Subtotal</td><td colspan="4" class="right">${fmt(invoice.subtotal)}</td></tr>
        ${invoice.discountAmount > 0 ? `<tr><td colspan="2">Discount</td><td colspan="4" class="right">- ${fmt(invoice.discountAmount)}</td></tr>` : ''}
        <tr><td colspan="2"><b>Total</b></td><td colspan="4" class="right"><b>${fmt(invoice.totalAmount)}</b></td></tr>
        <tr><td colspan="2">Paid</td><td colspan="4" class="right">${fmt(invoice.paidAmount)}</td></tr>
        <tr><td colspan="2"><b>Balance Due</b></td><td colspan="4" class="right accent"><b>${fmt(invoice.pendingAmount)}</b></td></tr>
      </tfoot>
    </table>

    ${invoice.notes ? `<p class="small muted">${html(invoice.notes)}</p>` : ''}
  `;

  return layout({
    title: `Invoice ${invoice.invoiceNumber}`,
    tenant,
    primaryColor: primary,
    body,
  });
}
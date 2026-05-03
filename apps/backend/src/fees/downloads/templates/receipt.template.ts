/**
 * @file receipt.template.ts
 * @description Payment receipt template. A4 portrait, professional layout,
 *   with watermark for VOIDED payments and clear totals breakdown.
 */

import { html, layout } from './_layout';
import { formatMoney, CurrencyContext } from '../../common/currency.util';

export interface ReceiptTemplateInput {
  payment: any;
  tenant: any;
  currency?: Partial<CurrencyContext>;
}

export function receiptTemplate(input: ReceiptTemplateInput): string {
  const { payment, tenant } = input;
  const settings = tenant?.settings ?? {};
  const currency: Partial<CurrencyContext> = {
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    currencyPosition: settings.currencyPosition,
    currencyDecimals: settings.currencyDecimals,
    locale: settings.locale,
    ...input.currency,
  };
  const fmt = (n: number) => formatMoney(n, currency);
  const primary = settings.primaryColor ?? '#1E40AF';

  const sf = payment.studentFee;
  const student = sf?.student;
  const allocations = payment.allocations ?? [];

  const allocationRows = allocations
    .map(
      (a: any, i: number) => `<tr>
        <td>${i + 1}</td>
        <td>${html(a.studentFeeComponent?.name ?? '—')}</td>
        <td class="right">${fmt(a.amount)}</td>
      </tr>`,
    )
    .join('');

  const isVoided = payment.status === 'VOIDED';

  const body = `
    ${isVoided ? `<div class="watermark">VOIDED</div>` : ''}
    <div class="row between">
      <div>
        <h1 class="accent">Payment Receipt</h1>
        <div class="muted">#${html(payment.receiptNumber)}</div>
      </div>
      <div class="right">
        <div class="kv"><span class="k">Date:</span> <span class="v">${new Date(payment.paidAt).toLocaleString()}</span></div>
        <div class="kv"><span class="k">Method:</span> <span class="v">${html(payment.paymentMethod)}</span></div>
        ${payment.transactionId ? `<div class="kv"><span class="k">Txn:</span> <span class="v">${html(payment.transactionId)}</span></div>` : ''}
        ${payment.referenceNumber ? `<div class="kv"><span class="k">Ref:</span> <span class="v">${html(payment.referenceNumber)}</span></div>` : ''}
        <div class="kv"><span class="k">Status:</span> <span class="badge ${isVoided ? 'overdue' : 'paid'}">${html(payment.status)}</span></div>
      </div>
    </div>

    <div class="grid-2" style="margin-top:8px;">
      <div>
        <h3>Received From</h3>
        <div><b>${html(`${student?.firstName ?? ''} ${student?.lastName ?? ''}`)}</b></div>
        <div class="small muted">Adm #${html(student?.admissionNumber ?? '')}</div>
        ${student?.class ? `<div class="small muted">${html(student.class.name)}</div>` : ''}
      </div>
      <div>
        <h3>Applied To</h3>
        <div>${html(sf?.feeStructure?.name ?? '')}</div>
      </div>
    </div>

    <div class="summary">
      <div class="card"><div class="label">Amount Received</div><div class="value">${fmt(payment.amount)}</div></div>
      <div class="card"><div class="label">Allocated</div><div class="value">${fmt(payment.allocatedAmount)}</div></div>
      <div class="card"><div class="label">Overpayment</div><div class="value">${fmt(payment.overpaymentAmount ?? 0)}</div></div>
      <div class="card"><div class="label">Status</div><div class="value">${html(payment.status)}</div></div>
    </div>

    ${
      allocationRows
        ? `<h3>Allocation Detail</h3>
       <table>
         <thead><tr><th>#</th><th>Component</th><th class="right">Amount</th></tr></thead>
         <tbody>${allocationRows}</tbody>
       </table>`
        : ''
    }

    ${payment.notes ? `<p class="small muted">${html(payment.notes)}</p>` : ''}
    ${isVoided && payment.voidReason ? `<p class="small"><b>Void reason:</b> ${html(payment.voidReason)}</p>` : ''}

    <div class="signoff">
      <div class="line">Cashier Signature</div>
      <div class="line">Customer Signature</div>
    </div>
  `;

  return layout({
    title: `Receipt ${payment.receiptNumber}`,
    tenant,
    primaryColor: primary,
    body,
  });
}
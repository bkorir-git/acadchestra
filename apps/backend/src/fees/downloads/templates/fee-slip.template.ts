/**
 * @file fee-slip.template.ts
 * @description Per-class per-term fee slip — the page parents take home.
 *   Shows tuition, extras, total, payment instructions, due dates.
 */

import { html, layout } from './_layout';
import { formatMoney, CurrencyContext } from '../../common/currency.util';

export interface FeeSlipInput {
  year: { id: string; name: string };
  term: { id: string; name: string; startDate?: Date; endDate?: Date };
  klass: { id: string; name: string; gradeName?: string };
  components: Array<{
    name: string;
    amount: number;
    category: string;
    isCompulsory: boolean;
    dueDate?: Date | null;
  }>;
  total: number;
  paymentRules?: Array<{ byWeek: number; minPercentage: number }>;
  tenant: any;
  currency: Partial<CurrencyContext>;
}

export function feeSlipTemplate(input: FeeSlipInput): string {
  const { year, term, klass, components, total, paymentRules, tenant, currency } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const primary = tenant?.settings?.primaryColor ?? '#1E40AF';

  const rows = components
    .map(
      (c, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${html(c.name)}</b></td>
        <td>${html(c.category)}</td>
        <td>${c.isCompulsory ? '<span class="badge paid">Required</span>' : '<span class="badge pending">Optional</span>'}</td>
        <td>${c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '—'}</td>
        <td class="right">${fmt(c.amount)}</td>
      </tr>`,
    )
    .join('');

  const rulesHtml = paymentRules?.length
    ? `<h3>Payment Schedule</h3>
       <ul class="small">
         ${paymentRules
           .map(
             (r) =>
               `<li>By end of <b>week ${r.byWeek}</b> of ${html(term.name)}: at least <b>${r.minPercentage}%</b> of fees paid.</li>`,
           )
           .join('')}
       </ul>`
    : '';

  const body = `
    <div class="row between">
      <div>
        <h1 class="accent">Fee Slip</h1>
        <div class="muted">${html(klass.name)}${klass.gradeName ? ` · ${html(klass.gradeName)}` : ''}</div>
      </div>
      <div class="right">
        <div class="kv"><span class="k">Year:</span> <span class="v">${html(year.name)}</span></div>
        <div class="kv"><span class="k">Term:</span> <span class="v">${html(term.name)}</span></div>
        ${term.startDate ? `<div class="kv"><span class="k">Period:</span> <span class="v">${new Date(term.startDate).toLocaleDateString()} → ${term.endDate ? new Date(term.endDate).toLocaleDateString() : ''}</span></div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr><th>#</th><th>Component</th><th>Category</th><th>Type</th><th>Due</th><th class="right">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="5">Total payable for ${html(term.name)}</td><td class="right">${fmt(total)}</td></tr>
      </tfoot>
    </table>

    ${rulesHtml}

    <h3>Payment Instructions</h3>
    <p class="small">
      Make payments to ${html(tenant.name)}.
      ${tenant.email ? `Email: ${html(tenant.email)}.` : ''}
      ${tenant.phone ? `Phone: ${html(tenant.phone)}.` : ''}
      Quote your child's admission number on every transfer.
    </p>

    <div class="signoff">
      <div class="line">Issued by</div>
      <div class="line">Parent / Guardian Signature</div>
    </div>
  `;

  return layout({
    title: `Fee Slip — ${klass.name} ${term.name}`,
    tenant,
    primaryColor: primary,
    body,
  });
}
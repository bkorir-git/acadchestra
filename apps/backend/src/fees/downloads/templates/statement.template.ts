/**
 * @file statement.template.ts
 * @description Renders a StudentStatement (as-at-date) into HTML for
 *   Puppeteer. Shows summary tiles, active fees, and full ledger lines.
 */

import { html, layout } from './_layout';
import { formatMoney, CurrencyContext } from '../../common/currency.util';
import { StatementData } from '../../student-fees/student-statement.service';

export function statementTemplate(data: StatementData): string {
  const currency: Partial<CurrencyContext> = {
    currency: data.currency,
    currencySymbol: data.currencySymbol,
  };
  const fmt = (n: number) => formatMoney(n, currency);
  const primary = '#1E40AF';

  const lineRows = data.lines
    .map(
      (l) => `<tr>
        <td>${new Date(l.date).toLocaleDateString()}</td>
        <td>${html(l.description)}</td>
        <td class="small muted">${html(l.reference ?? '—')}</td>
        <td class="right">${l.debit > 0 ? fmt(l.debit) : ''}</td>
        <td class="right" style="color:#065f46;">${l.credit > 0 ? fmt(l.credit) : ''}</td>
        <td class="right"><b>${fmt(l.balance)}</b></td>
      </tr>`,
    )
    .join('');

  const activeRows = data.activeFees
    .map(
      (f) => `<tr>
        <td>${html(f.feeStructureName)}</td>
        <td class="small muted">${html(f.academicYearName)}${f.academicTermName ? ` · ${html(f.academicTermName)}` : ''}</td>
        <td class="right">${fmt(f.totalAmount)}</td>
        <td class="right">${fmt(f.paidAmount)}</td>
        <td class="right">${fmt(f.pendingAmount)}</td>
        <td><span class="badge ${String(f.status).toLowerCase()}">${html(f.status)}</span></td>
      </tr>`,
    )
    .join('');

  const body = `
    <div class="row between">
      <div>
        <h1 class="accent">Fee Statement</h1>
        <div class="muted">As at ${new Date(data.asOfDate).toLocaleDateString()}</div>
      </div>
      <div class="right">
        <div class="kv"><span class="k">Student:</span> <span class="v">${html(data.student.fullName)}</span></div>
        <div class="kv"><span class="k">Adm #:</span> <span class="v">${html(data.student.admissionNumber)}</span></div>
        ${data.student.className ? `<div class="kv"><span class="k">Class:</span> <span class="v">${html(data.student.className)}</span></div>` : ''}
      </div>
    </div>

    <div class="summary">
      <div class="card"><div class="label">Total Billed</div><div class="value">${fmt(data.summary.totalBilled)}</div></div>
      <div class="card"><div class="label">Total Paid</div><div class="value" style="color:#065f46;">${fmt(data.summary.totalPaid)}</div></div>
      <div class="card"><div class="label">Discounts/Waivers</div><div class="value">${fmt(data.summary.totalDiscounts)}</div></div>
      <div class="card"><div class="label">Balance</div><div class="value" style="color:#991b1b;">${fmt(data.summary.balanceAsOf)}</div></div>
    </div>

    ${
      activeRows
        ? `<h3>Active Fees</h3>
       <table>
         <thead><tr><th>Structure</th><th>Year/Term</th><th class="right">Billed</th><th class="right">Paid</th><th class="right">Balance</th><th>Status</th></tr></thead>
         <tbody>${activeRows}</tbody>
       </table>`
        : ''
    }

    <h3>Transactions</h3>
    ${
      lineRows
        ? `<table>
        <thead><tr><th>Date</th><th>Description</th><th>Reference</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th></tr></thead>
        <tbody>${lineRows}</tbody>
      </table>`
        : '<p class="muted small">No transactions in the selected period.</p>'
    }
  `;

  return layout({
    title: `Statement — ${data.student.fullName}`,
    tenant: {
      name: data.tenant.name,
      address: data.tenant.address,
      phone: data.tenant.phone,
      email: data.tenant.email,
      logo: data.tenant.logo,
    },
    primaryColor: primary,
    body,
  });
}

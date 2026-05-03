/**
 * @file fee-matrix.template.ts
 * @description Compact grade × term matrix view of an entire year's fee
 *   structures. This is the parent-friendly "Early Bird Academy"-style
 *   single-page document that shows tuition + extras for every grade
 *   across each term.
 */

import { html, layout } from './_layout';
import { formatMoney, CurrencyContext } from '../../common/currency.util';

export interface FeeMatrixInput {
  year: { id: string; name: string };
  terms: Array<{ id: string; name: string; termNumber: number }>;
  rows: Array<{
    label: string;
    classId?: string;
    gradeId?: string;
    perTerm: Record<
      string,
      {
        tuition: number;
        extras: Array<{ name: string; amount: number; category: string }>;
        total: number;
      }
    >;
  }>;
  tenant: any;
  currency: Partial<CurrencyContext>;
}

export function feeMatrixTemplate(input: FeeMatrixInput): string {
  const { year, terms, rows, tenant, currency } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const primary = tenant?.settings?.primaryColor ?? '#1E40AF';

  const headerRow = `<tr>
    <th>Grade / Class</th>
    ${terms.map((t) => `<th class="right">${html(t.name)}</th>`).join('')}
    <th class="right">Year Total</th>
  </tr>`;

  const tableRows = rows
    .map((r) => {
      const yearTotal = terms.reduce(
        (s, t) => s + (r.perTerm[t.id]?.total ?? 0),
        0,
      );
      return `<tr>
        <td><b>${html(r.label)}</b></td>
        ${terms
          .map((t) => {
            const cell = r.perTerm[t.id];
            if (!cell) return `<td class="right muted">—</td>`;
            const extras = cell.extras
              .map(
                (e) =>
                  `<div class="small muted">${html(e.name)}: ${fmt(e.amount)}</div>`,
              )
              .join('');
            return `<td class="right">
              <div><b>${fmt(cell.tuition)}</b></div>
              ${extras}
              <div class="small accent" style="margin-top:4px;">Total ${fmt(cell.total)}</div>
            </td>`;
          })
          .join('')}
        <td class="right"><b>${fmt(yearTotal)}</b></td>
      </tr>`;
    })
    .join('');

  const totalsByTerm = terms.map((t) =>
    rows.reduce((s, r) => s + (r.perTerm[t.id]?.total ?? 0), 0),
  );
  const grandTotal = totalsByTerm.reduce((a, b) => a + b, 0);

  const body = `
    <h1 class="accent">${html(tenant.name)} — Fees Structure ${html(year.name)}</h1>
    <p class="muted small">Per-grade × per-term breakdown. Amounts shown are in ${html(currency.currency ?? 'KES')}.</p>
    <table>
      <thead>${headerRow}</thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr>
          <td>Totals</td>
          ${totalsByTerm.map((v) => `<td class="right">${fmt(v)}</td>`).join('')}
          <td class="right">${fmt(grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="signoff">
      <div class="line">Authorised by</div>
      <div class="line">School Stamp</div>
    </div>
  `;

  return layout({
    title: `Fees Structure — ${year.name}`,
    tenant,
    primaryColor: primary,
    body,
    pageOrientation: 'landscape',
  });
}
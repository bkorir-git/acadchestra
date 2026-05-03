/**
 * @file fee-structure.template.ts
 * @description Renders a single FeeStructure (with levels + components or
 *   flat components) into HTML for Puppeteer. Tenant-branded header, totals
 *   summary, per-level/component table.
 */

import { html, layout } from './_layout';
import { formatMoney, CurrencyContext } from '../../common/currency.util';

export interface FeeStructureTemplateInput {
  structure: any;
  tenant: any;
  currency: Partial<CurrencyContext>;
}

export function feeStructureTemplate(input: FeeStructureTemplateInput): string {
  const { structure, tenant, currency } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const settings = tenant?.settings ?? {};
  const primary = settings.primaryColor ?? '#1E40AF';

  const scopeLine = `${html(structure.scope)}${
    structure.curriculum ? ` · ${html(structure.curriculum.name)}` : ''
  }${structure.grade ? ` · ${html(structure.grade.name)}` : ''}${
    structure.class ? ` · ${html(structure.class.name)}` : ''
  }${structure.stream ? ` · ${html(structure.stream.name)}` : ''}`;

  const levelsHtml =
    structure.scope === 'SCHOOL_WIDE' && (structure.levels?.length ?? 0) > 0
      ? structure.levels
          .map((lvl: any) => {
            const rows = lvl.components
              .map(
                (c: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td><b>${html(c.name)}</b>${c.description ? `<div class="small muted">${html(c.description)}</div>` : ''}</td>
              <td>${html(c.category)}</td>
              <td class="right">${fmt(c.amount)}</td>
              <td>${c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '—'}</td>
              <td>${c.isCompulsory ? '<span class="badge paid">Compulsory</span>' : '<span class="badge pending">Optional</span>'}</td>
            </tr>`,
              )
              .join('');
            return `
        <h3>${html(lvl.levelLabel)}</h3>
        <table>
          <thead>
            <tr><th>#</th><th>Component</th><th>Category</th><th class="right">Amount</th><th>Due</th><th>Type</th></tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="3">Total for ${html(lvl.levelLabel)}</td><td class="right">${fmt(lvl.totalAmount)}</td><td colspan="2"></td></tr></tfoot>
        </table>`;
          })
          .join('')
      : `
      <table>
        <thead>
          <tr><th>#</th><th>Component</th><th>Category</th><th class="right">Amount</th><th>Due</th><th>Type</th></tr>
        </thead>
        <tbody>
          ${(structure.feeComponents ?? [])
            .map(
              (c: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td><b>${html(c.name)}</b>${c.description ? `<div class="small muted">${html(c.description)}</div>` : ''}</td>
              <td>${html(c.category)}</td>
              <td class="right">${fmt(c.amount)}</td>
              <td>${c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '—'}</td>
              <td>${c.isCompulsory ? '<span class="badge paid">Compulsory</span>' : '<span class="badge pending">Optional</span>'}</td>
            </tr>`,
            )
            .join('')}
        </tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="right">${fmt(structure.totalAmount ?? 0)}</td><td colspan="2"></td></tr></tfoot>
      </table>`;

  const body = `
    <div class="row between">
      <div>
        <h1 class="accent">Fee Structure</h1>
        <div class="muted">${html(structure.name)}</div>
      </div>
      <div class="right">
        <div class="kv"><span class="k">Year:</span> <span class="v">${html(structure.academicYear?.name ?? '')}</span></div>
        ${structure.academicTerm ? `<div class="kv"><span class="k">Term:</span> <span class="v">${html(structure.academicTerm.name)}</span></div>` : ''}
        <div class="kv"><span class="k">Scope:</span> <span class="v">${scopeLine}</span></div>
        ${structure.isLocked ? `<div class="kv"><span class="badge overdue">LOCKED</span></div>` : ''}
      </div>
    </div>
    ${structure.description ? `<p class="muted small">${html(structure.description)}</p>` : ''}
    ${levelsHtml}
  `;

  return layout({
    title: `Fee Structure — ${structure.name}`,
    tenant,
    primaryColor: primary,
    body,
  });
}

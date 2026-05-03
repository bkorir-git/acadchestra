/**
 * @file _layout.ts
 * @description Shared HTML shell used by every PDF template. Defines a
 *   neutral, print-friendly stylesheet (Roboto-like, 11pt, 1.4 line-height)
 *   and a header/footer pattern that templates extend.
 */

export interface LayoutContext {
  title: string;
  tenant: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
  };
  primaryColor?: string;
  body: string;
  pageOrientation?: 'portrait' | 'landscape';
}

const escapeHtml = (s: any): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const html = escapeHtml;

export function layout(ctx: LayoutContext): string {
  const color = ctx.primaryColor ?? '#1E40AF';
  const orientation =
    ctx.pageOrientation === 'landscape' ? 'landscape' : 'portrait';

  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8" />
  <title>${escapeHtml(ctx.title)}</title>
  <style>
    @page { size: A4 ${orientation}; margin: 14mm; }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", sans-serif;
      font-size: 10.5pt; color: #111827; line-height: 1.45; -webkit-print-color-adjust: exact;
    }
    h1, h2, h3, h4 { margin: 0 0 6px; color: #111827; }
    h1 { font-size: 18pt; letter-spacing: .2px; }
    h2 { font-size: 13pt; }
    h3 { font-size: 11pt; text-transform: uppercase; letter-spacing: .6px; color: ${color}; }
    .muted { color: #6b7280; }
    .small { font-size: 9pt; }
    .right { text-align: right; }
    .center { text-align: center; }
    .row { display: flex; gap: 12px; }
    .row.between { justify-content: space-between; align-items: flex-start; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 10px; background: ${color}15; color: ${color}; font-size: 9pt; font-weight: 600; }
    .accent { color: ${color}; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 6px 8px; text-align: left; vertical-align: top; }
    thead th { background: ${color}; color: white; font-weight: 600; font-size: 9.5pt; letter-spacing: .3px; }
    tbody tr:nth-child(even) td { background: #f9fafb; }
    tbody td { border-bottom: 1px solid #e5e7eb; }
    tfoot td { font-weight: 700; border-top: 2px solid ${color}; }

    /* Big logo block at the top */
    .brand {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 3px solid ${color};
      margin-bottom: 14px;
    }
    .brand .logo-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 8px;
    }
    .brand .logo-wrap img {
      max-height: 110px;
      max-width: 220px;
      object-fit: contain;
    }
    .brand .name {
      font-size: 20pt;
      font-weight: 800;
      color: ${color};
      letter-spacing: .3px;
      margin-top: 4px;
    }
    .brand .meta {
      font-size: 9.5pt;
      color: #4b5563;
      margin-top: 4px;
    }

    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
    .summary .card { background: #f3f4f6; border-radius: 6px; padding: 8px 10px; }
    .summary .label { font-size: 8.5pt; text-transform: uppercase; color: #6b7280; letter-spacing: .4px; }
    .summary .value { font-size: 12pt; font-weight: 700; color: #111827; margin-top: 2px; }
    .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 8.5pt; color: #6b7280; text-align: center; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 8.5pt; font-weight: 600; }
    .badge.paid    { background: #d1fae5; color: #065f46; }
    .badge.partial { background: #fef3c7; color: #92400e; }
    .badge.pending { background: #e0e7ff; color: #3730a3; }
    .badge.overdue { background: #fee2e2; color: #991b1b; }
    .badge.waived  { background: #ede9fe; color: #5b21b6; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .kv { font-size: 9.5pt; }
    .kv .k { color: #6b7280; }
    .kv .v { font-weight: 600; }
    .signoff { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; font-size: 9.5pt; }
    .signoff .line { border-top: 1px solid #9ca3af; padding-top: 4px; color: #4b5563; }
    .watermark { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-size: 76pt; color: ${color}10; transform: rotate(-22deg); pointer-events: none; }
  </style>
</head><body>
  <div class="brand">
    ${
      ctx.tenant.logo
        ? `<div class="logo-wrap"><img src="${escapeHtml(ctx.tenant.logo)}" alt="${escapeHtml(ctx.tenant.name)} logo" /></div>`
        : ''
    }
    <div class="name">${escapeHtml(ctx.tenant.name)}</div>
    <div class="meta">
      ${ctx.tenant.address ? escapeHtml(ctx.tenant.address) : ''}
      ${ctx.tenant.phone ? ` · Tel: ${escapeHtml(ctx.tenant.phone)}` : ''}
      ${ctx.tenant.email ? ` · ${escapeHtml(ctx.tenant.email)}` : ''}
    </div>
  </div>
  ${ctx.body}
  <div class="footer">Generated on ${new Date().toLocaleString()} · ${escapeHtml(ctx.tenant.name)}</div>
</body></html>`;
}

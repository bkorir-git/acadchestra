/**
 * @file word-builders.ts
 * @description Typed docx@9 builders that mirror the HTML templates above.
 *   Each function returns a Document. The renderer service packs it into
 *   a Buffer and the controller streams it via sendBinary().
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { CurrencyContext, formatMoney } from '../../common/currency.util';

const PRIMARY = '1E40AF';
const MUTED = '6B7280';

function tableHeaderCell(text: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: PRIMARY, color: 'auto' },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 }),
        ],
      }),
    ],
  });
}

function bodyCell(
  text: string,
  opts: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts.bold, size: 20 })],
      }),
    ],
  });
}

/** Try to fetch the logo bytes. Failures are non-fatal — the document
 *  will simply render without an image. */
async function fetchLogoBuffer(url?: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function brandingParagraphs(tenant: any): Promise<Paragraph[]> {
  const out: Paragraph[] = [];

  const logoBuffer = await fetchLogoBuffer(
    tenant?.logo ?? tenant?.settings?.logoUrl,
  );

  if (logoBuffer) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 140, height: 140 },
          } as any),
        ],
      }),
    );
  }

  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: tenant?.name ?? 'School',
          bold: true,
          size: 36,
          color: PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: [tenant?.address, tenant?.phone, tenant?.email]
            .filter(Boolean)
            .join(' · '),
          size: 18,
          color: MUTED,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  );
  return out;
}

async function headerBlock(tenant: any, title: string): Promise<Paragraph[]> {
  const branding = await brandingParagraphs(tenant);
  return [
    ...branding,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title, bold: true, color: PRIMARY })],
    }),
    new Paragraph({ text: '' }),
  ];
}

// ─── Fee Structure DOCX ──────────────────────────────────────────────
export async function buildFeeStructureDoc(input: {
  structure: any;
  tenant: any;
  currency: Partial<CurrencyContext>;
  pageOrientation?: 'portrait' | 'landscape';
}): Promise<Document> {
  const { structure, tenant, currency, pageOrientation } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const children: any[] = await headerBlock(
    tenant,
    `Fee Structure — ${structure.name}`,
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Year: ${structure.academicYear?.name ?? ''}${
            structure.academicTerm
              ? ' · Term: ' + structure.academicTerm.name
              : ''
          } · Scope: ${structure.scope}`,
          size: 20,
          color: MUTED,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  );

  if (structure.scope === 'SCHOOL_WIDE' && structure.levels?.length) {
    for (const lvl of structure.levels) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: lvl.levelLabel, color: PRIMARY, bold: true }),
          ],
        }),
      );
      const rows: TableRow[] = [
        new TableRow({
          children: [
            tableHeaderCell('#'),
            tableHeaderCell('Component'),
            tableHeaderCell('Category'),
            tableHeaderCell('Amount'),
          ],
        }),
        ...lvl.components.map(
          (c: any, i: number) =>
            new TableRow({
              children: [
                bodyCell(String(i + 1)),
                bodyCell(c.name, { bold: true }),
                bodyCell(c.category),
                bodyCell(fmt(c.amount), { align: AlignmentType.RIGHT }),
              ],
            }),
        ),
        new TableRow({
          children: [
            bodyCell('', { bold: true }),
            bodyCell('Total', { bold: true }),
            bodyCell(''),
            bodyCell(fmt(lvl.totalAmount), {
              bold: true,
              align: AlignmentType.RIGHT,
            }),
          ],
        }),
      ];
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows,
        }),
        new Paragraph({ text: '' }),
      );
    }
  } else {
    const rows: TableRow[] = [
      new TableRow({
        children: [
          tableHeaderCell('#'),
          tableHeaderCell('Component'),
          tableHeaderCell('Category'),
          tableHeaderCell('Amount'),
        ],
      }),
      ...(structure.feeComponents ?? []).map(
        (c: any, i: number) =>
          new TableRow({
            children: [
              bodyCell(String(i + 1)),
              bodyCell(c.name, { bold: true }),
              bodyCell(c.category),
              bodyCell(fmt(c.amount), { align: AlignmentType.RIGHT }),
            ],
          }),
      ),
      new TableRow({
        children: [
          bodyCell(''),
          bodyCell('Total', { bold: true }),
          bodyCell(''),
          bodyCell(fmt(structure.totalAmount ?? 0), {
            bold: true,
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
    ];
    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
    );
  }

  return new Document({
    creator: tenant?.name ?? 'Acadchestra',
    title: `Fee Structure — ${structure.name}`,
    description: `Fee structure document for ${tenant?.name ?? 'school'}`,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                pageOrientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
          },
        },
        children,
      },
    ],
  });
}

// ─── Year Matrix DOCX ────────────────────────────────────────────────
export async function buildFeeMatrixDoc(input: {
  year: { id: string; name: string };
  terms: Array<{ id: string; name: string }>;
  rows: Array<{
    label: string;
    perTerm: Record<
      string,
      {
        tuition: number;
        extras: { name: string; amount: number }[];
        total: number;
      }
    >;
  }>;
  tenant: any;
  currency: Partial<CurrencyContext>;
  pageOrientation?: 'portrait' | 'landscape';
}): Promise<Document> {
  const { year, terms, rows, tenant, currency, pageOrientation } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const children: any[] = await headerBlock(
    tenant,
    `Fees Structure — ${year.name}`,
  );

  const headerRow = new TableRow({
    children: [
      tableHeaderCell('Grade / Class'),
      ...terms.map((t) => tableHeaderCell(t.name)),
      tableHeaderCell('Year Total'),
    ],
  });
  const bodyRows = rows.map((r) => {
    const yearTotal = terms.reduce(
      (s, t) => s + (r.perTerm[t.id]?.total ?? 0),
      0,
    );
    return new TableRow({
      children: [
        bodyCell(r.label, { bold: true }),
        ...terms.map((t) => {
          const cell = r.perTerm[t.id];
          if (!cell) return bodyCell('—', { align: AlignmentType.RIGHT });
          const text = `${fmt(cell.tuition)}${
            cell.extras.length
              ? '\n' +
                cell.extras.map((e) => `${e.name}: ${fmt(e.amount)}`).join('\n')
              : ''
          }`;
          return bodyCell(text, { align: AlignmentType.RIGHT });
        }),
        bodyCell(fmt(yearTotal), { bold: true, align: AlignmentType.RIGHT }),
      ],
    });
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...bodyRows],
    }),
  );

  return new Document({
    creator: tenant?.name ?? 'Acadchestra',
    title: `Fees Structure — ${year.name}`,
    description: 'Year fee matrix',
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                pageOrientation === 'portrait'
                  ? PageOrientation.PORTRAIT
                  : PageOrientation.LANDSCAPE,
            },
          },
        },
        children,
      },
    ],
  });
}

// ─── Class+Term Slip DOCX ────────────────────────────────────────────
export async function buildFeeSlipDoc(input: {
  year: { name: string };
  term: { name: string };
  klass: { name: string; gradeName?: string };
  components: Array<{
    name: string;
    amount: number;
    category: string;
    isCompulsory: boolean;
    dueDate?: Date | null;
  }>;
  total: number;
  tenant: any;
  currency: Partial<CurrencyContext>;
  pageOrientation?: 'portrait' | 'landscape';
}): Promise<Document> {
  const {
    year,
    term,
    klass,
    components,
    total,
    tenant,
    currency,
    pageOrientation,
  } = input;
  const fmt = (n: number) => formatMoney(n, currency);
  const children: any[] = await headerBlock(tenant, `Fee Slip — ${klass.name}`);
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Year: ${year.name} · Term: ${term.name}${
            klass.gradeName ? ' · Grade: ' + klass.gradeName : ''
          }`,
          color: MUTED,
          size: 20,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  );

  const rows: TableRow[] = [
    new TableRow({
      children: [
        tableHeaderCell('#'),
        tableHeaderCell('Component'),
        tableHeaderCell('Category'),
        tableHeaderCell('Type'),
        tableHeaderCell('Amount'),
      ],
    }),
    ...components.map(
      (c, i) =>
        new TableRow({
          children: [
            bodyCell(String(i + 1)),
            bodyCell(c.name, { bold: true }),
            bodyCell(c.category),
            bodyCell(c.isCompulsory ? 'Required' : 'Optional'),
            bodyCell(fmt(c.amount), { align: AlignmentType.RIGHT }),
          ],
        }),
    ),
    new TableRow({
      children: [
        bodyCell(''),
        bodyCell('Total payable', { bold: true }),
        bodyCell(''),
        bodyCell(''),
        bodyCell(fmt(total), { bold: true, align: AlignmentType.RIGHT }),
      ],
    }),
  ];
  children.push(
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
  );

  return new Document({
    creator: tenant?.name ?? 'Acadchestra',
    title: `Fee Slip — ${klass.name} ${term.name}`,
    description: 'Per-class per-term fee slip',
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation:
                pageOrientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
          },
        },
        children,
      },
    ],
  });
}

export { Packer };

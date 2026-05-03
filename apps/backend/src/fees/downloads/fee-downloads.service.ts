/**
 * @file fee-downloads.service.ts
 * @description Aggregates data needed by download templates and produces
 *   PDF/Word buffers. Supports:
 *     - single fee structure (PDF/Word)
 *     - year-wide compact matrix (PDF/Word)
 *     - per-class per-term slip (PDF/Word)
 *     - invoice (PDF)
 *     - searchable bulk download manifest (zip-of-pdfs delegated to
 *       controller-level streaming if requested).
 *
 *   The service is renderer-agnostic — it loads the data once, then asks
 *   the PDF or Word renderer to materialise it. This avoids duplicate
 *   queries when the user requests both formats.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PdfRendererService } from './pdf-renderer.service';
import { WordRendererService } from './word-renderer.service';
import { feeStructureTemplate } from './templates/fee-structure.template';
import { feeMatrixTemplate } from './templates/fee-matrix.template';
import { feeSlipTemplate } from './templates/fee-slip.template';
import { invoiceTemplate } from './templates/invoice.template';
import {
  buildFeeMatrixDoc,
  buildFeeSlipDoc,
  buildFeeStructureDoc,
} from './templates/word-builders';
import { CurrencyContext } from '../common/currency.util';
import { roundMoney } from '../common/fee-math.util';

export type Orientation = 'portrait' | 'landscape';

@Injectable()
export class FeeDownloadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfRendererService,
    private readonly word: WordRendererService,
  ) {}

  private async loadTenant(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });
    if (!t) throw new NotFoundException('Tenant not found');
    // Surface the logo url consistently — templates use `tenant.logo`.
    const logo = t.logo ?? t.settings?.logoUrl ?? null;
    return { ...t, logo };
  }

  private currencyOf(tenant: any): Partial<CurrencyContext> {
    const s = tenant?.settings;
    return {
      currency: s?.currency ?? 'KES',
      currencySymbol: s?.currencySymbol ?? 'KSh',
      currencyPosition: s?.currencyPosition ?? 'BEFORE',
      currencyDecimals: s?.currencyDecimals ?? 2,
      locale: s?.locale ?? 'en-KE',
    };
  }

  // ─── Single structure ───────────────────────────────────────────
  private async loadStructure(tenantId: string, id: string) {
    const s = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: {
        feeComponents: { orderBy: { sortOrder: 'asc' } },
        levels: {
          orderBy: { levelLabel: 'asc' },
          include: { components: { orderBy: { sortOrder: 'asc' } } },
        },
        academicYear: true,
        academicTerm: true,
        curriculum: true,
        grade: true,
        class: true,
        stream: true,
      },
    });
    if (!s) throw new NotFoundException('Fee structure not found');
    const totalAmount =
      s.scope === 'SCHOOL_WIDE'
        ? roundMoney(s.levels.reduce((sum, l) => sum + l.totalAmount, 0))
        : roundMoney(s.feeComponents.reduce((sum, c) => sum + c.amount, 0));
    return { ...s, totalAmount };
  }

  async structurePdf(
    tenantId: string,
    id: string,
    orientation: Orientation = 'portrait',
  ) {
    const tenant = await this.loadTenant(tenantId);
    const structure = await this.loadStructure(tenantId, id);
    const html = feeStructureTemplate({
      structure,
      tenant,
      currency: this.currencyOf(tenant),
      pageOrientation: orientation,
    });
    return {
      buffer: await this.pdf.renderHtml(html, {
        landscape: orientation === 'landscape',
      }),
      filenameBase: structure.name,
    };
  }

  async structureWord(
    tenantId: string,
    id: string,
    orientation: Orientation = 'portrait',
  ) {
    const tenant = await this.loadTenant(tenantId);
    const structure = await this.loadStructure(tenantId, id);
    const doc = await buildFeeStructureDoc({
      structure,
      tenant,
      currency: this.currencyOf(tenant),
      pageOrientation: orientation,
    });
    return {
      buffer: await this.word.render(doc),
      filenameBase: structure.name,
    };
  }

  // ─── Year matrix ────────────────────────────────────────────────
  private async loadMatrix(
    tenantId: string,
    yearId: string,
    options: { curriculumId?: string; gradeId?: string; classId?: string } = {},
  ) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: yearId, tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    const terms = await this.prisma.academicTerm.findMany({
      where: { tenantId, academicYearId: yearId, hasFees: true },
      orderBy: { termNumber: 'asc' },
    });

    const structures = await this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        academicYearId: yearId,
        ...(options.curriculumId && { curriculumId: options.curriculumId }),
      },
      include: {
        feeComponents: { orderBy: { sortOrder: 'asc' } },
        levels: {
          include: {
            components: { orderBy: { sortOrder: 'asc' } },
            class: { select: { id: true, name: true, gradeId: true } },
          },
        },
        class: { select: { id: true, name: true } },
        grade: { select: { id: true, name: true } },
        curriculum: { select: { id: true, name: true } },
      },
    });

    type Row = {
      label: string;
      classId?: string;
      gradeId?: string;
      perTerm: Record<
        string,
        {
          tuition: number;
          extras: { name: string; amount: number; category: string }[];
          total: number;
        }
      >;
    };
    const rowMap = new Map<string, Row>();

    for (const s of structures) {
      const termId = s.academicTermId;
      if (!termId) continue;
      // SCHOOL_WIDE w/ levels
      for (const lvl of s.levels) {
        if (options.classId && lvl.classId !== options.classId) continue;
        if (options.gradeId && lvl.gradeId !== options.gradeId) continue;
        const key = lvl.classId ?? lvl.gradeId ?? lvl.levelLabel;
        const row =
          rowMap.get(key) ??
          ({
            label: lvl.levelLabel,
            classId: lvl.classId ?? undefined,
            gradeId: lvl.gradeId ?? undefined,
            perTerm: {},
          } as Row);
        const tuition = lvl.components[0]?.amount ?? 0;
        const extras = lvl.components.slice(1).map((c) => ({
          name: c.name,
          amount: c.amount,
          category: c.category,
        }));
        row.perTerm[termId] = {
          tuition,
          extras,
          total: lvl.totalAmount,
        };
        rowMap.set(key, row);
      }
      // CLASS_SPECIFIC / GRADE_SPECIFIC / CURRICULUM_WIDE
      if (s.scope !== 'SCHOOL_WIDE' && s.feeComponents.length) {
        const key = s.classId ?? s.gradeId ?? s.curriculumId ?? s.id;
        const label =
          (s as any).class?.name ??
          (s as any).grade?.name ??
          (s as any).curriculum?.name ??
          s.name;
        const row =
          rowMap.get(key) ??
          ({
            label,
            classId: s.classId ?? undefined,
            gradeId: s.gradeId ?? undefined,
            perTerm: {},
          } as Row);
        const tuition = s.feeComponents[0]?.amount ?? 0;
        const extras = s.feeComponents.slice(1).map((c) => ({
          name: c.name,
          amount: c.amount,
          category: c.category,
        }));
        const total = s.feeComponents.reduce((a, c) => a + c.amount, 0);
        row.perTerm[termId] = {
          tuition,
          extras,
          total: roundMoney(total),
        };
        rowMap.set(key, row);
      }
    }

    return {
      year: { id: year.id, name: year.name },
      terms: terms.map((t) => ({
        id: t.id,
        name: t.name,
        termNumber: t.termNumber,
      })),
      rows: Array.from(rowMap.values()).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true }),
      ),
    };
  }

  async yearMatrixPdf(
    tenantId: string,
    yearId: string,
    opts: { curriculumId?: string; gradeId?: string; classId?: string } = {},
    orientation: Orientation = 'landscape',
  ) {
    const tenant = await this.loadTenant(tenantId);
    const matrix = await this.loadMatrix(tenantId, yearId, opts);
    const html = feeMatrixTemplate({
      ...matrix,
      tenant,
      currency: this.currencyOf(tenant),
      pageOrientation: orientation,
    });
    return {
      buffer: await this.pdf.renderHtml(html, {
        landscape: orientation === 'landscape',
      }),
      filenameBase: `Fees Structure - ${matrix.year.name}`,
    };
  }

  async yearMatrixWord(
    tenantId: string,
    yearId: string,
    opts: { curriculumId?: string; gradeId?: string; classId?: string } = {},
    orientation: Orientation = 'landscape',
  ) {
    const tenant = await this.loadTenant(tenantId);
    const matrix = await this.loadMatrix(tenantId, yearId, opts);
    const doc = await buildFeeMatrixDoc({
      ...matrix,
      tenant,
      currency: this.currencyOf(tenant),
      pageOrientation: orientation,
    });
    return {
      buffer: await this.word.render(doc),
      filenameBase: `Fees Structure - ${matrix.year.name}`,
    };
  }

  // ─── Class + Term slip ─────────────────────────────────────────
  private async loadClassTermSlip(
    tenantId: string,
    yearId: string,
    termId: string,
    classId: string,
  ) {
    const [year, term, klass] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: yearId, tenantId },
      }),
      this.prisma.academicTerm.findFirst({
        where: { id: termId, tenantId, academicYearId: yearId },
      }),
      this.prisma.class.findFirst({
        where: { id: classId, tenantId },
        include: { grade: true },
      }),
    ]);
    if (!year) throw new NotFoundException('Year not found');
    if (!term) throw new NotFoundException('Term not found');
    if (!klass) throw new NotFoundException('Class not found');

    const structures = await this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        academicYearId: yearId,
        academicTermId: termId,
        OR: [
          { scope: 'SCHOOL_WIDE' },
          { scope: 'CLASS_SPECIFIC', classId },
          { scope: 'GRADE_SPECIFIC', gradeId: klass.gradeId },
          { scope: 'CURRICULUM_WIDE', curriculumId: klass.grade.curriculumId },
        ],
      },
      include: {
        feeComponents: { orderBy: { sortOrder: 'asc' } },
        levels: {
          include: { components: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    const components: Array<{
      name: string;
      amount: number;
      category: string;
      isCompulsory: boolean;
      dueDate?: Date | null;
    }> = [];

    for (const s of structures) {
      if (s.scope === 'SCHOOL_WIDE') {
        // curriculum compatibility — a school-wide matrix is only safe
        // to apply if it isn't constrained to a different curriculum.
        if (s.curriculumId && s.curriculumId !== klass.grade.curriculumId) {
          continue;
        }
        const lvl =
          s.levels.find((l) => l.classId === classId) ??
          s.levels.find((l) => l.gradeId === klass.gradeId) ??
          s.levels.find(
            (l) =>
              (l.levelLabel ?? '').trim().toLowerCase() ===
              (klass.grade?.name ?? '').trim().toLowerCase(),
          );
        if (lvl) {
          for (const c of lvl.components) {
            components.push({
              name: c.name,
              amount: c.amount,
              category: c.category,
              isCompulsory: c.isCompulsory,
              dueDate: c.dueDate,
            });
          }
        }
      } else {
        for (const c of s.feeComponents) {
          components.push({
            name: c.name,
            amount: c.amount,
            category: c.category,
            isCompulsory: c.isCompulsory,
            dueDate: c.dueDate,
          });
        }
      }
    }

    const total = roundMoney(components.reduce((a, c) => a + c.amount, 0));
    return {
      year: { id: year.id, name: year.name },
      term: {
        id: term.id,
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
      },
      klass: { id: klass.id, name: klass.name, gradeName: klass.grade.name },
      components,
      total,
    };
  }

  async classTermSlipPdf(
    tenantId: string,
    yearId: string,
    termId: string,
    classId: string,
    orientation: Orientation = 'portrait',
  ) {
    const tenant = await this.loadTenant(tenantId);
    const slip = await this.loadClassTermSlip(
      tenantId,
      yearId,
      termId,
      classId,
    );
    const paymentRules = await this.prisma.feePaymentRule.findMany({
      where: {
        tenantId,
        OR: [{ termId }, { termId: null }],
        isActive: true,
      },
      orderBy: { byWeek: 'asc' },
    });
    const html = feeSlipTemplate({
      ...slip,
      paymentRules: paymentRules.map((r) => ({
        byWeek: r.byWeek,
        minPercentage: r.minPercentage,
      })),
      tenant,
      currency: this.currencyOf(tenant),
      pageOrientation: orientation,
    });
    return {
      buffer: await this.pdf.renderHtml(html, {
        landscape: orientation === 'landscape',
      }),
      filenameBase: `Fee Slip - ${slip.klass.name} - ${slip.term.name}`,
    };
  }

  async classTermSlipWord(
    tenantId: string,
    yearId: string,
    termId: string,
    classId: string,
    orientation: Orientation = 'portrait',
  ) {
    const tenant = await this.loadTenant(tenantId);
    const slip = await this.loadClassTermSlip(
      tenantId,
      yearId,
      termId,
      classId,
    );
    const doc = await buildFeeSlipDoc({
      year: slip.year,
      term: { name: slip.term.name },
      klass: slip.klass,
      components: slip.components,
      total: slip.total,
      tenant,
      currency: this.currencyOf(tenant),
      pageOrientation: orientation,
    });
    return {
      buffer: await this.word.render(doc),
      filenameBase: `Fee Slip - ${slip.klass.name} - ${slip.term.name}`,
    };
  }

  // ─── Invoice PDF ───────────────────────────────────────────────
  async invoicePdf(tenantId: string, invoiceId: string) {
    const tenant = await this.loadTenant(tenantId);
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        student: { include: { class: { include: { grade: true } } } },
        feeStructure: true,
        academicTerm: true,
        academicYear: true,
        studentFee: {
          include: { components: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const html = invoiceTemplate({
      invoice,
      tenant,
      currency: this.currencyOf(tenant),
    });
    return {
      buffer: await this.pdf.renderHtml(html),
      filenameBase: `Invoice ${invoice.invoiceNumber}`,
    };
  }

  // ─── Search index for the downloads UI ─────────────────────────
  async searchOptions(
    tenantId: string,
    yearId?: string,
  ): Promise<{
    years: Array<{ id: string; name: string; isCurrent: boolean }>;
    terms: Array<{ id: string; name: string; academicYearId: string }>;
    curriculums: Array<{ id: string; name: string }>;
    grades: Array<{ id: string; name: string; curriculumId: string }>;
    classes: Array<{
      id: string;
      name: string;
      gradeId: string;
      academicYearId: string;
    }>;
    structures: Array<{
      id: string;
      name: string;
      academicYearId: string;
      academicTermId: string | null;
      scope: string;
    }>;
  }> {
    const [years, terms, curriculums, grades, classes, structures] =
      await Promise.all([
        this.prisma.academicYear.findMany({
          where: { tenantId },
          select: { id: true, name: true, isCurrent: true },
          orderBy: { startDate: 'desc' },
        }),
        this.prisma.academicTerm.findMany({
          where: { tenantId, ...(yearId && { academicYearId: yearId }) },
          select: { id: true, name: true, academicYearId: true },
          orderBy: { termNumber: 'asc' },
        }),
        this.prisma.curriculum.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.grade.findMany({
          where: { tenantId },
          select: {
            id: true,
            name: true,
            curriculumId: true,
            levelOrder: true,
          },
          orderBy: [{ curriculumId: 'asc' }, { levelOrder: 'asc' }],
        }),
        this.prisma.class.findMany({
          where: { tenantId, ...(yearId && { academicYearId: yearId }) },
          select: {
            id: true,
            name: true,
            gradeId: true,
            academicYearId: true,
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.feeStructure.findMany({
          where: { tenantId, ...(yearId && { academicYearId: yearId }) },
          select: {
            id: true,
            name: true,
            academicYearId: true,
            academicTermId: true,
            scope: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
    return { years, terms, curriculums, grades, classes, structures };
  }
}

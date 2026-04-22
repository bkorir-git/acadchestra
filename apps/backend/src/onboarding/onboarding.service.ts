/**
 * @description Onboarding checklist service — Phase 3.
 *
 *   Detects whether a tenant has completed the minimum setup needed for
 *   day-to-day operation. Returns a 6-step checklist plus a pointer to the
 *   next actionable step so the frontend can render the OnboardingBanner
 *   with a clear CTA.
 *
 *   Steps (in order, each blocks the next in the UI):
 *     1. hasAcademicYear    — a current year is set (isCurrent=true)
 *     2. hasTerms           — the current year has at least one term
 *     3. hasClasses         — the current year has at least one class
 *     4. hasFeeStructures   — the current year has at least one fee structure
 *     5. hasStudents        — the tenant has at least one student record
 *     6. hasEnrollments     — at least one StudentClassHistory is isCurrent
 *                             in the current year (students actually IN the year)
 *
 *   hasSettings (tenant-level localization/branding) is reported as an
 *   informational extra step but not blocking — settings are auto-created
 *   with sensible defaults on tenant provisioning.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface OnboardingSteps {
  hasAcademicYear: boolean;
  hasTerms: boolean;
  hasClasses: boolean;
  hasFeeStructures: boolean;
  hasStudents: boolean;
  hasEnrollments: boolean;
  hasSettings: boolean;
}

export interface OnboardingNextStep {
  key: keyof OnboardingSteps;
  label: string;
  href: string;
}

export interface OnboardingChecklistResponse {
  complete: boolean;
  completedCount: number;
  totalCount: number;
  steps: OnboardingSteps;
  nextStep: OnboardingNextStep | null;
  academicYearId: string | null;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getChecklist(tenantId: string): Promise<OnboardingChecklistResponse> {
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
    });

    const yearId = currentYear?.id ?? null;

    // All checks in parallel
    const [termCount, classCount, feeCount, studentCount, enrollCount, settings] =
      await Promise.all([
        yearId
          ? this.prisma.academicTerm.count({
              where: { tenantId, academicYearId: yearId },
            })
          : Promise.resolve(0),
        yearId
          ? this.prisma.class.count({
              where: { tenantId, academicYearId: yearId },
            })
          : Promise.resolve(0),
        yearId
          ? this.prisma.feeStructure.count({
              where: { tenantId, academicYearId: yearId },
            })
          : Promise.resolve(0),
        this.prisma.student.count({ where: { tenantId } }),
        yearId
          ? this.prisma.studentClassHistory.count({
              where: { tenantId, academicYearId: yearId, isCurrent: true },
            })
          : Promise.resolve(0),
        this.prisma.tenantSettings.findUnique({ where: { tenantId } }),
      ]);

    const steps: OnboardingSteps = {
      hasAcademicYear: !!currentYear,
      hasTerms: termCount > 0,
      hasClasses: classCount > 0,
      hasFeeStructures: feeCount > 0,
      hasStudents: studentCount > 0,
      hasEnrollments: enrollCount > 0,
      hasSettings: !!settings,
    };

    // Completion is measured against the 6 blocking steps only.
    const blockingKeys: (keyof OnboardingSteps)[] = [
      'hasAcademicYear',
      'hasTerms',
      'hasClasses',
      'hasFeeStructures',
      'hasStudents',
      'hasEnrollments',
    ];
    const completedCount = blockingKeys.filter((k) => steps[k]).length;
    const totalCount = blockingKeys.length;
    const complete = completedCount === totalCount;

    // Resolve next actionable step (first incomplete blocking step).
    let nextStep: OnboardingNextStep | null = null;
    if (!steps.hasAcademicYear) {
      nextStep = {
        key: 'hasAcademicYear',
        label: 'Create your first academic year',
        href: '/academic/years',
      };
    } else if (!steps.hasTerms) {
      nextStep = {
        key: 'hasTerms',
        label: 'Add terms to your academic year',
        href: `/academic/${yearId}/terms`,
      };
    } else if (!steps.hasClasses) {
      nextStep = {
        key: 'hasClasses',
        label: 'Create your first class',
        href: `/academic/${yearId}/classes/create`,
      };
    } else if (!steps.hasFeeStructures) {
      nextStep = {
        key: 'hasFeeStructures',
        label: 'Set up fee structures',
        href: '/fees/structures/create',
      };
    } else if (!steps.hasStudents) {
      nextStep = {
        key: 'hasStudents',
        label: 'Add your first student',
        href: '/students/create',
      };
    } else if (!steps.hasEnrollments) {
      nextStep = {
        key: 'hasEnrollments',
        label: 'Enroll students into classes',
        href: `/academic/${yearId}/classes`,
      };
    }

    return {
      complete,
      completedCount,
      totalCount,
      steps,
      nextStep,
      academicYearId: yearId,
    };
  }
}
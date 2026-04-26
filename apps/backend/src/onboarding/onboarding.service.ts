/**
 * @file onboarding.service.ts
 * @module onboarding
 * @description The orchestrator that drives every Admin from "blank school"
 *   to "ready to admit students" in 5 steps.
 *
 *   The 6-step checklist (in strict dependency order):
 *     1. CURRICULUM       — Adopt template OR create custom (BLOCKING)
 *     2. ACADEMIC_YEAR    — Create year + auto-generated terms       (BLOCKING)
 *     3. CONFIGURATION    — Bulk-write fee, student, guardian rules
 *     4. FIRST_CLASS      — At least one Class exists for current year
 *     5. FIRST_STUDENT    — At least one Student admitted
 *     6. FEE_STRUCTURE    — At least one FeeStructure for current year
 *
 *   The frontend renders the wizard step-by-step using the response from
 *   `GET /onboarding/checklist`. Steps 1-3 are MANDATORY (banner blocks
 *   dashboard); steps 4-6 are recommended but dismissible.
 *
 *   When all 6 steps are complete, the service marks `Tenant.isOnboarded = true`
 *   and the wizard disappears.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  OnboardingStep,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';
import { ConfigService } from '../common/config/config.service';

export interface OnboardingStepInfo {
  key: OnboardingStep;
  label: string;
  description: string;
  blocking: boolean;
  done: boolean;
  href: string;
  /** When false, this step is "ready to do" — the previous blocking step is satisfied. */
  unlocked: boolean;
}

export interface OnboardingChecklistResponse {
  tenantId: string;
  isOnboarded: boolean;
  blockingComplete: boolean;
  fullyComplete: boolean;
  completedCount: number;
  blockingCount: number;
  totalCount: number;
  currentStep: OnboardingStep | null;
  steps: OnboardingStepInfo[];
  context: {
    currentYearId: string | null;
    defaultCurriculumId: string | null;
  };
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  // ───────────────────────────── CHECKLIST
  async getChecklist(tenantId: string): Promise<OnboardingChecklistResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isOnboarded: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [
      curriculum,
      currentYear,
      configsCount,
      classCount,
      studentCount,
      feeStructureCount,
    ] = await Promise.all([
      this.prisma.curriculum.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { isDefault: 'desc' },
      }),
      this.prisma.academicYear.findFirst({
        where: { tenantId, isCurrent: true },
      }),
      // Treat configuration as "done" once admin has touched configs (10+ rows).
      // Defaults are auto-seeded, so they don't count.
      this.prisma.config.count({ where: { tenantId } }),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.feeStructure.count({ where: { tenantId } }),
    ]);

    const yearId = currentYear?.id ?? null;
    const curriculumId = curriculum?.id ?? null;

    // Steps in evaluation order
    const steps: OnboardingStepInfo[] = [
      {
        key: OnboardingStep.CURRICULUM,
        label: 'Choose your curriculum',
        description:
          'Pick CBC, British, IGCSE, K-8-4-4, University, or build custom. Grades come from this.',
        blocking: true,
        done: !!curriculum,
        href: '/onboarding/curriculum',
        unlocked: true,
      },
      {
        key: OnboardingStep.ACADEMIC_YEAR,
        label: 'Set up the academic year',
        description:
          'Define the year window and let us auto-generate terms based on your structure.',
        blocking: true,
        done: !!currentYear,
        href: '/onboarding/academic-year',
        unlocked: !!curriculum,
      },
      {
        key: OnboardingStep.CONFIGURATION,
        label: 'Configure school rules',
        description:
          'Email requirements, admission number format, fee schedules, guardian rules.',
        blocking: true,
        // We mark configuration done once the admin has explicitly written
        // ANY config (the defaults seed creates >40 rows already, so we
        // require a marker config to be set).
        done: configsCount > 50, // defaults ≈ 45 rows; >50 implies user wrote at least a few
        href: '/onboarding/configuration',
        unlocked: !!currentYear,
      },
      {
        key: OnboardingStep.FIRST_CLASS,
        label: 'Create your first class',
        description: 'A class belongs to a grade and may have streams.',
        blocking: false,
        done: classCount > 0,
        href: yearId ? `/academic/${yearId}/classes/create` : '#',
        unlocked: !!currentYear && !!curriculum,
      },
      {
        key: OnboardingStep.FEE_STRUCTURE,
        label: 'Set up fee structure',
        description: 'Charge by school, curriculum, grade, class, or stream.',
        blocking: false,
        done: feeStructureCount > 0,
        href: '/fees/structures/create',
        unlocked: !!currentYear,
      },
      {
        key: OnboardingStep.FIRST_STUDENT,
        label: 'Admit your first student',
        description:
          'The admission counter generates the lifetime ID automatically.',
        blocking: false,
        done: studentCount > 0,
        href: '/students/create',
        unlocked: classCount > 0,
      },
    ];

    const blockingSteps = steps.filter((s) => s.blocking);
    const blockingComplete = blockingSteps.every((s) => s.done);
    const fullyComplete = steps.every((s) => s.done);
    const completedCount = steps.filter((s) => s.done).length;
    const currentStep = steps.find((s) => !s.done && s.unlocked)?.key ?? null;

    // Auto-mark tenant onboarded when blocking is complete (idempotent)
    if (blockingComplete && !tenant.isOnboarded) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { isOnboarded: true, onboardedAt: new Date() },
      });
      await this.activity.log({
        action: ActivityAction.ONBOARDING_STEP,
        entityType: ActivityEntityType.ONBOARDING,
        entityId: tenantId,
        tenantId,
        message: 'Onboarding completed (blocking steps satisfied)',
      });
    }

    return {
      tenantId,
      isOnboarded: tenant.isOnboarded || blockingComplete,
      blockingComplete,
      fullyComplete,
      completedCount,
      blockingCount: blockingSteps.length,
      totalCount: steps.length,
      currentStep,
      steps,
      context: {
        currentYearId: yearId,
        defaultCurriculumId: curriculumId,
      },
    };
  }

  // ───────────────────────────── MARK STEP DONE (manual, optional)
  async markStepDone(tenantId: string, step: OnboardingStep, userId?: string) {
    await this.activity.log({
      action: ActivityAction.ONBOARDING_STEP,
      entityType: ActivityEntityType.ONBOARDING,
      entityId: tenantId,
      tenantId,
      userId,
      message: `Onboarding step "${step}" marked done`,
      metadata: { step },
    });
    return this.getChecklist(tenantId);
  }

  // ───────────────────────────── DISMISS WIZARD (force-complete)
  async dismiss(tenantId: string, userId?: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isOnboarded: true, onboardedAt: new Date() },
    });
    await this.activity.log({
      action: ActivityAction.ONBOARDING_STEP,
      entityType: ActivityEntityType.ONBOARDING,
      entityId: tenantId,
      tenantId,
      userId,
      message: 'Onboarding wizard manually dismissed',
    });
    return this.getChecklist(tenantId);
  }
}

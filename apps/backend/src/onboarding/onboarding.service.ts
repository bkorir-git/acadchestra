/**
 * @file onboarding.service.ts
 * @module onboarding
 * @description Onboarding orchestrator. Drives Admin from "blank school" to
 *   "ready to admit students" in a strict 6-step flow. SuperAdmin is NOT a
 *   tenant operator and receives a safe N/A stub from this service so the
 *   shared dashboard layout never breaks.
 *
 *   The 6-step checklist (in dependency order):
 *     1. CURRICULUM       — Adopt template OR create custom (BLOCKING)
 *     2. ACADEMIC_YEAR    — Create year + auto-generate terms     (BLOCKING)
 *     3. CONFIGURATION    — Bulk-write fee/student/guardian rules (BLOCKING)
 *     4. FIRST_CLASS      — At least one Class for current year
 *     5. FEE_STRUCTURE    — At least one FeeStructure for current year
 *     6. FIRST_STUDENT    — At least one Student admitted
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
  /** True once the previous BLOCKING step is satisfied. */
  unlocked: boolean;
}

export interface OnboardingChecklistResponse {
  tenantId: string | null;
  isOnboarded: boolean;
  blockingComplete: boolean;
  fullyComplete: boolean;
  completedCount: number;
  blockingCount: number;
  totalCount: number;
  currentStep: OnboardingStep | null;
  steps: OnboardingStepInfo[];
  /** True for SuperAdmin / system users — frontend should hide the wizard. */
  notApplicable?: boolean;
  context: {
    currentYearId: string | null;
    defaultCurriculumId: string | null;
  };
}

/** Marker key written when admin saves the Configuration step. */
const CONFIG_COMPLETED_CATEGORY = 'onboarding';
const CONFIG_COMPLETED_KEY = 'configurationCompleted';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  /** Empty stub for non-tenant users (SuperAdmin) — no DB hits. */
  buildNotApplicable(): OnboardingChecklistResponse {
    return {
      tenantId: null,
      isOnboarded: true,
      blockingComplete: true,
      fullyComplete: true,
      completedCount: 0,
      blockingCount: 0,
      totalCount: 0,
      currentStep: null,
      steps: [],
      notApplicable: true,
      context: { currentYearId: null, defaultCurriculumId: null },
    };
  }

  // ───────────────────────────── CHECKLIST
  async getChecklist(
    tenantId: string | null,
  ): Promise<OnboardingChecklistResponse> {
    if (!tenantId) return this.buildNotApplicable();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isOnboarded: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Fast path: already onboarded → minimal payload, no expensive scans.
    if (tenant.isOnboarded) {
      return {
        tenantId,
        isOnboarded: true,
        blockingComplete: true,
        fullyComplete: true,
        completedCount: 0,
        blockingCount: 0,
        totalCount: 0,
        currentStep: null,
        steps: [],
        context: {
          currentYearId:
            (
              await this.prisma.academicYear.findFirst({
                where: { tenantId, isCurrent: true },
                select: { id: true },
              })
            )?.id ?? null,
          defaultCurriculumId: null,
        },
      };
    }

    const [
      curriculum,
      currentYear,
      configurationCompleted,
      classCount,
      studentCount,
      feeStructureCount,
    ] = await Promise.all([
      this.prisma.curriculum.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { isDefault: 'desc' },
        select: { id: true },
      }),
      this.prisma.academicYear.findFirst({
        where: { tenantId, isCurrent: true },
        select: { id: true },
      }),
      this.config.getBoolean(
        tenantId,
        CONFIG_COMPLETED_CATEGORY,
        CONFIG_COMPLETED_KEY,
        false,
      ),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.feeStructure.count({ where: { tenantId } }),
    ]);

    const yearId = currentYear?.id ?? null;
    const curriculumId = curriculum?.id ?? null;

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
        done: configurationCompleted,
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

    // Auto-mark tenant onboarded once blocking is satisfied (idempotent).
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

  // ───────────────────────────── MARK STEP DONE
  /**
   * Frontend calls this after each blocking step is saved successfully.
   */
  async markStepDone(tenantId: string, step: OnboardingStep, userId?: string) {
    if (step === OnboardingStep.CONFIGURATION) {
      await this.config.set(
        tenantId,
        CONFIG_COMPLETED_CATEGORY,
        CONFIG_COMPLETED_KEY,
        true,
        'Set when admin completes the onboarding Configuration sweep',
      );
    }
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

  // ───────────────────────────── DISMISS WIZARD
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

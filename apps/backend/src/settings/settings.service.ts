/**
 * @description Tenant settings service - auto-provisions defaults, supports SuperAdmin cross-tenant.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CURRENCIES, findCurrency } from './constants/currencies';
import { TIMEZONES, LOCALES, DATE_FORMATS } from './constants/timezones';

interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  userRoles?: Array<{ role?: { name?: string | null } | null }>;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  private isSuperAdmin(actor: RequestActor) {
    return !!actor.userRoles?.some((r) => r?.role?.name === 'SuperAdmin');
  }

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  /** Resolve target tenant: SuperAdmin can specify, Admin is locked to theirs */
  private resolveTenantId(actor: RequestActor, requestedTenantId?: string): string {
    if (this.isSuperAdmin(actor)) {
      if (!requestedTenantId) {
        throw new BadRequestException('SuperAdmin must specify tenantId');
      }
      return requestedTenantId;
    }
    if (requestedTenantId && requestedTenantId !== actor.tenantId) {
      throw new ForbiddenException('You can only manage settings for your own tenant');
    }
    return actor.tenantId;
  }

  /** Auto-create settings with defaults on first access */
  private async ensureSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    let settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await this.prisma.tenantSettings.create({
        data: { tenantId },
      });
    }
    return settings;
  }

  async getSettings(actor: RequestActor, requestedTenantId?: string) {
    const tenantId = this.resolveTenantId(actor, requestedTenantId);
    const settings = await this.ensureSettings(tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        domain: true,
        email: true,
        planType: true,
        logo: true,
      },
    });

    return { ...settings, tenant };
  }

  /** Public read — used by FE to load current-user tenant settings (no tenant switch) */
  async getMySettings(actor: RequestActor) {
    return this.getSettings(actor, actor.tenantId);
  }

  async updateSettings(
    dto: UpdateSettingsDto,
    actor: RequestActor,
    requestedTenantId?: string,
  ) {
    const tenantId = this.resolveTenantId(actor, requestedTenantId);
    await this.ensureSettings(tenantId);

    // Auto-fill currency symbol / decimals if currency code changed
    const data: Prisma.TenantSettingsUpdateInput = { ...dto } as any;
    if (dto.currency && !dto.currencySymbol) {
      const info = findCurrency(dto.currency);
      if (info) {
        data.currencySymbol = info.symbol;
        if (dto.currencyDecimals === undefined) {
          data.currencyDecimals = info.decimals;
        }
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tenantSettings.update({
        where: { tenantId },
        data,
      });

      await this.activityService.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.TENANT_SETTINGS,
          entityId: result.id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} updated settings${
            this.isSuperAdmin(actor) && requestedTenantId !== actor.tenantId
              ? ` for tenant ${tenantId}`
              : ''
          }`,
          metadata: { updatedKeys: Object.keys(dto) },
        },
        tx,
      );

      return result;
    });

    return updated;
  }

  /** SuperAdmin: list all schools with their basic settings for the selector UI */
  async listTenantsForSettings(actor: RequestActor) {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Only SuperAdmin can list all tenants');
    }

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        domain: true,
        email: true,
        logo: true,
        planType: true,
        isActive: true,
        settings: {
          select: {
            currency: true,
            currencySymbol: true,
            timezone: true,
            locale: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            users: true,
            students: true,
          },
        },
      },
    });

    return tenants;
  }

  /** Static catalogs */
  getCatalogs() {
    return {
      currencies: CURRENCIES,
      timezones: TIMEZONES,
      locales: LOCALES,
      dateFormats: DATE_FORMATS,
      paymentMethods: [
        'CASH', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD',
        'ONLINE', 'CHEQUE', 'MOBILE_MONEY', 'OTHER',
      ],
    };
  }
}

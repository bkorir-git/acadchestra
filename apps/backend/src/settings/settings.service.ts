/**
 * @file settings.service.ts
 * @description Tenant settings service — STABLE typed values only.
 *   Dynamic rules moved to Config . SuperAdmin can manage
 *   any tenant's settings via the ?tenantId= query param or /tenant/:id route.
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
import {
  RequestActor,
  isSuperAdmin,
  actorDisplayName,
} from '../common/types/request-actor.type';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private resolveTenantId(
    actor: RequestActor,
    requestedTenantId?: string,
  ): string {
    if (isSuperAdmin(actor)) {
      if (!requestedTenantId)
        throw new BadRequestException('SuperAdmin must specify tenantId');
      return requestedTenantId;
    }
    if (requestedTenantId && requestedTenantId !== actor.tenantId) {
      throw new ForbiddenException(
        'You can only manage settings for your own tenant',
      );
    }
    return actor.tenantId;
  }

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

  async getMySettings(actor: RequestActor) {
    return this.getSettings(actor, actor.tenantId);
  }

  /**
   * Patch a section. The frontend sends {section, values}; we validate the
   * section name and whitelist allowed keys per section to prevent leaking
   * dynamic-rule fields into TenantSettings.
   */
  async patchSection(
    actor: RequestActor,
    section: 'localization' | 'branding' | 'communications',
    values: Partial<UpdateSettingsDto>,
    requestedTenantId?: string,
  ) {
    const tenantId = this.resolveTenantId(actor, requestedTenantId);
    await this.ensureSettings(tenantId);

    const allowed = SECTION_ALLOWED_FIELDS[section];
    if (!allowed) throw new BadRequestException(`Unknown section "${section}"`);

    const data: any = {};
    for (const k of Object.keys(values)) {
      if (!allowed.includes(k as any)) {
        throw new BadRequestException(
          `Field "${k}" not allowed in section "${section}"`,
        );
      }
      (data as any)[k] = (values as any)[k];
    }

    // Auto-fill currency symbol/decimals when currency changes
    if (data.currency && !data.currencySymbol) {
      const info = findCurrency(data.currency);
      if (info) {
        data.currencySymbol = info.symbol;
        if (data.currencyDecimals === undefined)
          data.currencyDecimals = info.decimals;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.tenantSettings.update({
        where: { tenantId },
        data,
      });
      await this.activity.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.TENANT_SETTINGS,
          entityId: result.id,
          tenantId,
          userId: actor.id,
          message: `${actorDisplayName(actor)} updated ${section} settings`,
          metadata: { section, keys: Object.keys(data) },
        },
        tx,
      );
      return result;
    });

    return updated;
  }

  // SuperAdmin: list all schools for the selector
  async listTenantsForSettings(actor: RequestActor) {
    if (!isSuperAdmin(actor)) {
      throw new ForbiddenException('Only SuperAdmin can list all tenants');
    }
    return this.prisma.tenant.findMany({
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
        _count: { select: { users: true, students: true } },
      },
    });
  }

  getCatalogs() {
    return {
      currencies: CURRENCIES,
      timezones: TIMEZONES,
      locales: LOCALES,
      dateFormats: DATE_FORMATS,
    };
  }
}

const SECTION_ALLOWED_FIELDS: Record<string, (keyof UpdateSettingsDto)[]> = {
  localization: [
    'currency',
    'currencySymbol',
    'currencyPosition',
    'currencyDecimals',
    'timezone',
    'locale',
    'dateFormat',
    'timeFormat',
    'firstDayOfWeek',
  ],
  branding: [
    'logoUrl',
    'faviconUrl',
    'primaryColor',
    'secondaryColor',
    'brandTagline',
  ],
  communications: [
    // Reserved for stable identity fields (sender name/address) once added to schema
  ],
};

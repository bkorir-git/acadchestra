/**
 * @file config.service.ts
 * @module common/config
 * @description The Config Engine. All tenant-specific business rules read/write
 *   here. Provides typed accessors with sensible defaults for hot keys, plus a
 *   bulk category reader for "load everything for the academic page" use cases.
 *
 *   In-memory cache keyed by `${tenantId}:${category}` with 5-minute TTL.
 *   Invalidated on every write.
 *
 *   Conventions:
 *     - Keys are dot-namespaced internally (`student.requireEmail`) but stored
 *       split as (category='student', key='requireEmail') for indexed bulk reads.
 *     - Values are JSON. Callers narrow with `getBoolean`, `getNumber`, `getArray`.
 *     - Defaults are hardcoded here (not in DB) so a brand-new tenant works
 *       even before the bootstrap seed completes.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_TENANT_CONFIGS,
  DefaultConfig,
} from '../../../prisma/seeds/default-configs.seed';

interface CacheEntry {
  value: Map<string, unknown>;
  expiresAt: number;
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 min

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────── DEFAULTS

  /** All defaults shipped with the system. Used by tenant bootstrap and as fallback. */
  static defaults(): DefaultConfig[] {
    return DEFAULT_TENANT_CONFIGS;
  }

  /** Returns the seeded default value for a (category,key) pair, or undefined. */
  static getDefault(category: string, key: string): unknown {
    return DEFAULT_TENANT_CONFIGS.find(
      (d) => d.category === category && d.key === key,
    )?.value;
  }

  // ─────────────────────────────────────────────── BULK READERS

  /**
   * Load every config row for a category, merged on top of defaults.
   * Cached for 5 minutes per (tenant, category).
   */
  async getCategory<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(tenantId: string, category: string): Promise<T> {
    const cacheKey = `${tenantId}:${category}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Object.fromEntries(cached.value) as T;
    }

    // Start with defaults
    const merged = new Map<string, unknown>();
    for (const d of DEFAULT_TENANT_CONFIGS) {
      if (d.category === category) merged.set(d.key, d.value);
    }

    // Overlay tenant-specific overrides
    const rows = await this.prisma.config.findMany({
      where: { tenantId, category },
      select: { key: true, value: true },
    });
    for (const r of rows) {
      merged.set(r.key, r.value);
    }

    this.cache.set(cacheKey, {
      value: merged,
      expiresAt: Date.now() + this.TTL_MS,
    });

    return Object.fromEntries(merged) as T;
  }

  /** Single value with default fallback. Reads from category cache. */
  async get<T = unknown>(
    tenantId: string,
    category: string,
    key: string,
  ): Promise<T | undefined> {
    const cat = await this.getCategory(tenantId, category);
    return cat[key] as T | undefined;
  }

  // ─────────────────────────────────────────────── TYPED ACCESSORS

  async getBoolean(
    tenantId: string,
    category: string,
    key: string,
    fallback = false,
  ): Promise<boolean> {
    const v = await this.get(tenantId, category, key);
    return typeof v === 'boolean' ? v : fallback;
  }

  async getNumber(
    tenantId: string,
    category: string,
    key: string,
    fallback = 0,
  ): Promise<number> {
    const v = await this.get(tenantId, category, key);
    return typeof v === 'number' ? v : fallback;
  }

  async getString(
    tenantId: string,
    category: string,
    key: string,
    fallback = '',
  ): Promise<string> {
    const v = await this.get(tenantId, category, key);
    return typeof v === 'string' ? v : fallback;
  }

  async getArray<T = unknown>(
    tenantId: string,
    category: string,
    key: string,
    fallback: T[] = [],
  ): Promise<T[]> {
    const v = await this.get(tenantId, category, key);
    return Array.isArray(v) ? (v as T[]) : fallback;
  }

  // ─────────────────────────────────────────────── WRITERS

  /**
   * Set a single config. Invalidates the category cache.
   */
  async set(
    tenantId: string,
    category: string,
    key: string,
    value: Prisma.InputJsonValue,
    description?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const result = await client.config.upsert({
      where: {
        tenantId_category_key: { tenantId, category, key },
      },
      create: { tenantId, category, key, value, description },
      update: { value, description: description ?? undefined },
    });
    this.invalidate(tenantId, category);
    return result;
  }

  /**
   * Bulk write — preferred for the onboarding "Configuration Sweep" page.
   * payload shape: { [category]: { [key]: value, ... }, ... }
   */
  async setBulk(
    tenantId: string,
    payload: Record<string, Record<string, unknown>>,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const writes: Array<Promise<unknown>> = [];

    for (const [category, kv] of Object.entries(payload)) {
      for (const [key, value] of Object.entries(kv)) {
        writes.push(
          client.config.upsert({
            where: {
              tenantId_category_key: { tenantId, category, key },
            },
            create: {
              tenantId,
              category,
              key,
              value: value as Prisma.InputJsonValue,
            },
            update: { value: value as Prisma.InputJsonValue },
          }),
        );
      }
    }

    await Promise.all(writes);

    // Invalidate every touched category
    for (const category of Object.keys(payload)) {
      this.invalidate(tenantId, category);
    }

    return { written: writes.length };
  }

  /**
   * Seed default configs for a new tenant. Called from Tenant bootstrap.
   * Idempotent — uses upsert with skipDuplicates semantics.
   */
  async seedDefaultsForTenant(tenantId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    await client.config.createMany({
      data: DEFAULT_TENANT_CONFIGS.map((d) => ({
        tenantId,
        category: d.category,
        key: d.key,
        value: d.value,
        description: d.description,
      })),
      skipDuplicates: true,
    });
    // Invalidate every category for this tenant
    for (const cat of new Set(DEFAULT_TENANT_CONFIGS.map((d) => d.category))) {
      this.invalidate(tenantId, cat);
    }
  }

  // ─────────────────────────────────────────────── ADMIN

  async listAll(tenantId: string) {
    return this.prisma.config.findMany({
      where: { tenantId },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async listCategories(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.config.findMany({
      where: { tenantId },
      distinct: ['category'],
      select: { category: true },
    });
    return rows.map((r) => r.category).sort();
  }

  // ─────────────────────────────────────────────── CACHE

  invalidate(tenantId: string, category?: string) {
    if (category) {
      this.cache.delete(`${tenantId}:${category}`);
    } else {
      // Drop every entry for this tenant
      for (const k of this.cache.keys()) {
        if (k.startsWith(`${tenantId}:`)) this.cache.delete(k);
      }
    }
  }

  invalidateAll() {
    this.cache.clear();
  }
}

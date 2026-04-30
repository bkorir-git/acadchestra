/**
 * @file policy.service.ts
 * @module common/policy
 * @description Policy engine — conditional rules with priority-based evaluation.
 *
 *   Policies sit ABOVE plain Configs:
 *     - Config: "is the rule on or off, what's its value?"
 *     - Policy: "given THIS context, should THIS rule fire?"
 *
 *   Examples:
 *     - "Students under 18 require a primary guardian" — student category
 *     - "Late enrollment after T2 incurs a 20% surcharge" — fee category
 *
 *   Rule format: a JSONLogic-style expression tree stored in `rules: Json`.
 *   This service intentionally keeps the engine MINIMAL (eq/lt/lte/gt/gte/and/or/not/var)
 *   so we can swap in a richer evaluator later without changing the surface.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policy.dto';

interface RequestActor {
  id: string;
  tenantId: string;
}

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────── CRUD
  async list(actor: RequestActor, category?: string, isActive?: boolean) {
    return this.prisma.policy.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: [{ category: 'asc' }, { priority: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, actor: RequestActor) {
    const p = await this.prisma.policy.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!p) throw new NotFoundException('Policy not found');
    return p;
  }

  async create(dto: CreatePolicyDto, actor: RequestActor) {
    return this.prisma.policy.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        category: dto.category.trim(),
        description: dto.description,
        rules: dto.rules as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        priority: dto.priority ?? 100,
      },
    });
  }

  async update(id: string, dto: UpdatePolicyDto, actor: RequestActor) {
    await this.findOne(id, actor);
    return this.prisma.policy.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        category: dto.category?.trim(),
        description: dto.description,
        rules: dto.rules ? (dto.rules as Prisma.InputJsonValue) : undefined,
        isActive: dto.isActive,
        priority: dto.priority,
      },
    });
  }

  async remove(id: string, actor: RequestActor) {
    await this.findOne(id, actor);
    await this.prisma.policy.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────── EVALUATION

  /**
   * Run every active policy in `category` against `context`.
   * Returns an array of decisions for transparency / audit.
   * Higher-priority policies (lower `priority` int) run first; if a policy
   * matches AND has `effect: 'deny'` set in its rules, evaluation short-circuits.
   */
  async evaluate(
    tenantId: string,
    category: string,
    context: Record<string, unknown>,
  ) {
    const policies = await this.prisma.policy.findMany({
      where: { tenantId, category, isActive: true },
      orderBy: { priority: 'asc' },
    });

    const results: Array<{
      id: string;
      name: string;
      matched: boolean;
      effect?: string;
    }> = [];

    for (const p of policies) {
      const rules = (p.rules ?? {}) as Record<string, unknown>;
      const matched = this.evalNode(rules, context);
      results.push({
        id: p.id,
        name: p.name,
        matched,
        effect: (rules as any).effect,
      });
      if (matched && (rules as any).effect === 'deny') break;
    }

    return {
      matchedDeny: results.some((r) => r.matched && r.effect === 'deny'),
      results,
    };
  }

  // ─────────────────────── MINIMAL JSONLogic-ish evaluator
  private evalNode(node: any, ctx: Record<string, unknown>): any {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((n) => this.evalNode(n, ctx));

    const [op, args] = Object.entries(node)[0] ?? [];
    if (!op) return undefined;

    const a = Array.isArray(args)
      ? args.map((x) => this.evalNode(x, ctx))
      : [this.evalNode(args, ctx)];

    switch (op) {
      case 'var': {
        const path = (args as string).split('.');
        let cur: any = ctx;
        for (const k of path) cur = cur?.[k];
        return cur;
      }
      case '==':
      case 'eq':
        return a[0] === a[1];
      case '!=':
      case 'neq':
        return a[0] !== a[1];
      case '<':
      case 'lt':
        return Number(a[0]) < Number(a[1]);
      case '<=':
      case 'lte':
        return Number(a[0]) <= Number(a[1]);
      case '>':
      case 'gt':
        return Number(a[0]) > Number(a[1]);
      case '>=':
      case 'gte':
        return Number(a[0]) >= Number(a[1]);
      case 'and':
        return (a as any[]).every(Boolean);
      case 'or':
        return (a as any[]).some(Boolean);
      case 'not':
        return !a[0];
      case 'in':
        return Array.isArray(a[1]) && (a[1] as any[]).includes(a[0]);
      default:
        this.logger.warn(`Unknown policy op: ${op}`);
        return undefined;
    }
  }
}

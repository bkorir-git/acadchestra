/**
 * @file token.service.ts
 * @module auth/services
 * @description Centralised JWT issuance for access + refresh + password-reset
 *   tokens. Each token type uses a distinct purpose claim ('access' | 'refresh'
 *   | 'reset') and a distinct TTL so a leaked reset link can never grant API
 *   access. Refresh tokens are signed with a separate secret to enable
 *   independent rotation in production.
 *
 *   TTLs are config-driven (security.sessionTimeoutMinutes etc.) with sane
 *   fallbacks so the service still works for SuperAdmin who has no tenant.
 * @description JWT issuance for access + refresh tokens, and DB-backed
 *   password reset tokens. Reset tokens are stored as SHA-256 hashes in
 *   the database — giving us one-time use, invalidation, and audit trail.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../../common/config/config.service';

export type TokenPurpose = 'access' | 'refresh';

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string | null;
  purpose: TokenPurpose;
  iat?: number;
  exp?: number;
}

export interface ResetTokenResult {
  rawToken: string; // send this in the email link
  expiresInSeconds: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly nestConfig: NestConfigService,
    private readonly tenantConfig: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────────── PRIVATE HELPERS

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  // ─────────────────────────────────────────── ACCESS

  async issueAccessToken(user: {
    id: string;
    email: string;
    tenantId: string | null;
  }): Promise<{ token: string; expiresInSeconds: number }> {
    const minutes = user.tenantId
      ? await this.tenantConfig.getNumber(
          user.tenantId,
          'security',
          'sessionTimeoutMinutes',
          60,
        )
      : 60;
    const expiresInSeconds = Math.max(5, minutes) * 60;

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      purpose: 'access',
    };
    const token = this.jwt.sign(payload, { expiresIn: expiresInSeconds });
    return { token, expiresInSeconds };
  }

  // ─────────────────────────────────────────── REFRESH

  async issueRefreshToken(user: {
    id: string;
    email: string;
    tenantId: string | null;
  }): Promise<{ token: string; expiresInSeconds: number }> {
    const days = this.nestConfig.get<number>('REFRESH_TOKEN_DAYS', 7);
    const expiresInSeconds = days * 24 * 60 * 60;
    const secret =
      this.nestConfig.get<string>('JWT_REFRESH_SECRET') ??
      this.nestConfig.get<string>('JWT_SECRET')!;

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      purpose: 'refresh',
    };
    const token = this.jwt.sign(payload, {
      secret,
      expiresIn: expiresInSeconds,
    });
    return { token, expiresInSeconds };
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      const secret =
        this.nestConfig.get<string>('JWT_REFRESH_SECRET') ??
        this.nestConfig.get<string>('JWT_SECRET')!;
      const decoded = this.jwt.verify<TokenPayload>(token, { secret });
      if (decoded.purpose !== 'refresh') throw new Error('not a refresh token');
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // ─────────────────────────────────────────── RESET (DB-backed)

  /**
   * Generates a cryptographically random reset token, stores its SHA-256
   * hash in the database, and returns the raw token to embed in the email.
   *
   * Any previously unused tokens for this user are invalidated first so
   * only the latest link ever works.
   */
  async createResetToken(
    userId: string,
    tenantId: string | null,
  ): Promise<ResetTokenResult> {
    const expiresInSeconds = 60 * 60; // 1 hour

    // Invalidate all previous unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId,
        tenantId: tenantId ?? '', // adjust if tenantId is optional in your schema
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      },
    });

    return { rawToken, expiresInSeconds };
  }

  /**
   * Verifies the raw token from the email link:
   *   1. Hashes it and looks up the record
   *   2. Checks it hasn't been used or expired
   *   3. Marks it as used (one-time only)
   *
   * Returns the userId so the caller can load and update the user.
   */
  async verifyAndConsumeResetToken(
    rawToken: string,
  ): Promise<{ userId: string }> {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      throw new UnauthorizedException('Reset link is invalid or has expired');
    }
    if (record.usedAt) {
      throw new UnauthorizedException('Reset link has already been used');
    }
    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Reset link has expired');
    }

    // Consume — mark used immediately so replay attacks fail
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { userId: record.userId };
  }
}

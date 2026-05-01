/**
 * @file login-attempt.service.ts
 * @module auth/services
 * @description Tracks failed login attempts per email with config-driven
 *   lockout. In-memory store keyed by lowercase email — sufficient for
 *   single-instance deploys. For multi-instance, swap the Map for Redis
 *   without changing the public API.
 *
 *   Reads from Config:
 *     security.maxLoginAttempts        (default 5)
 *     security.lockoutDurationMinutes  (default 15)
 *
 *   Successful login clears the counter. Lockout window auto-expires.
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '../../common/config/config.service';

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);
  private readonly attempts = new Map<string, AttemptRecord>();

  // Window during which failed attempts accumulate (independent of lockout).
  private readonly ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  private key(email: string) {
    return email.trim().toLowerCase();
  }

  /**
   * Throws if the account is currently locked out.
   * Call this BEFORE checking the password to avoid timing attacks.
   */
  async ensureNotLocked(tenantId: string | null, email: string): Promise<void> {
    const rec = this.attempts.get(this.key(email));
    if (!rec?.lockedUntil) return;

    const now = Date.now();
    if (rec.lockedUntil > now) {
      const remainingSec = Math.ceil((rec.lockedUntil - now) / 1000);
      const min = Math.ceil(remainingSec / 60);
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. Try again in ${min} minute${min === 1 ? '' : 's'}.`,
      );
    }
    // Lockout expired — clear it
    this.attempts.delete(this.key(email));
  }

  /**
   * Record a failed login. If the threshold is reached, lock the account
   * for the configured duration and throw an UnauthorizedException.
   */
  async recordFailure(
    tenantId: string | null,
    email: string,
  ): Promise<{ remainingAttempts: number }> {
    const max = tenantId
      ? await this.config.getNumber(tenantId, 'security', 'maxLoginAttempts', 5)
      : 5;
    const lockoutMin = tenantId
      ? await this.config.getNumber(
          tenantId,
          'security',
          'lockoutDurationMinutes',
          15,
        )
      : 15;

    const k = this.key(email);
    const now = Date.now();
    const existing = this.attempts.get(k);

    let rec: AttemptRecord;
    if (!existing || now - existing.firstAttemptAt > this.ATTEMPT_WINDOW_MS) {
      rec = { count: 1, firstAttemptAt: now };
    } else {
      rec = { ...existing, count: existing.count + 1 };
    }

    if (rec.count >= max) {
      rec.lockedUntil = now + lockoutMin * 60 * 1000;
      this.attempts.set(k, rec);
      this.logger.warn(`Account locked: ${email} (${rec.count} attempts)`);
      throw new UnauthorizedException(
        `Account locked due to too many failed attempts. Try again in ${lockoutMin} minute${lockoutMin === 1 ? '' : 's'}.`,
      );
    }

    this.attempts.set(k, rec);
    return { remainingAttempts: Math.max(0, max - rec.count) };
  }

  /** Wipes the counter on a successful login. */
  clear(email: string) {
    this.attempts.delete(this.key(email));
  }

  /** Admin diagnostics. */
  getStatus(email: string) {
    const rec = this.attempts.get(this.key(email));
    if (!rec) return { count: 0, locked: false };
    return {
      count: rec.count,
      locked: !!rec.lockedUntil && rec.lockedUntil > Date.now(),
      lockedUntil: rec.lockedUntil ? new Date(rec.lockedUntil) : null,
    };
  }
}

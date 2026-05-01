/**
 * @file password-policy.service.ts
 * @module auth/services
 * @description Config-driven password policy. Reads `security.password*` keys
 *   from the dynamic Config Engine so each tenant can dial complexity to
 *   match their security posture without redeploys.
 *
 *   Defaults (used only if Config rows are absent):
 *     - minLength: 8     - requireUppercase: true   - requireLowercase: true
 *     - requireNumber: true   - requireSymbol: true
 *
 *   Used by: register, change-password, reset-password.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '../../common/config/config.service';

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly config: ConfigService) {}

  async getPolicy(tenantId: string): Promise<PasswordPolicy> {
    return {
      minLength: await this.config.getNumber(
        tenantId,
        'security',
        'passwordMinLength',
        8,
      ),
      maxLength: await this.config.getNumber(
        tenantId,
        'security',
        'passwordMaxLength',
        100,
      ),
      requireUppercase: await this.config.getBoolean(
        tenantId,
        'security',
        'passwordRequireUppercase',
        true,
      ),
      requireLowercase: await this.config.getBoolean(
        tenantId,
        'security',
        'passwordRequireLowercase',
        true,
      ),
      requireNumber: await this.config.getBoolean(
        tenantId,
        'security',
        'passwordRequireNumber',
        true,
      ),
      requireSymbol: await this.config.getBoolean(
        tenantId,
        'security',
        'passwordRequireSymbol',
        true,
      ),
    };
  }

  /**
   * Validates a password against the tenant policy.
   * Throws BadRequestException with a single, user-friendly error message
   * listing every rule that was violated.
   */
  async validate(tenantId: string, password: string): Promise<void> {
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('Password is required');
    }

    const policy = await this.getPolicy(tenantId);
    const errors: string[] = [];

    if (password.length < policy.minLength) {
      errors.push(`be at least ${policy.minLength} characters`);
    }
    if (password.length > policy.maxLength) {
      errors.push(`not exceed ${policy.maxLength} characters`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('contain an uppercase letter');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('contain a lowercase letter');
    }
    if (policy.requireNumber && !/\d/.test(password)) {
      errors.push('contain a number');
    }
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('contain a symbol');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Password must ${errors.join(', ')}.`);
    }
  }
}

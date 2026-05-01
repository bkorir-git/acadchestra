/**
 * @file auth.service.ts
 * @module auth
 * @description Production-grade authentication service.
 *
 *   Capabilities:
 *     - register / login / logout
 *     - getProfile / updateProfile / changePassword
 *     - forgotPassword / resetPassword (real email via EmailService)
 *     - refreshAccessToken (rotating-style refresh)
 *     - createUserWithPasswordReset (admin-issued accounts → temp password email)
 *
 *   Everything is config-driven via the dynamic Config Engine:
 *     - password complexity rules
 *     - max login attempts + lockout duration
 *     - session (access token) timeout
 *     - 2FA toggle (informational — full TOTP wiring lives in a separate module)
 *
 *   Lockout protection is delegated to LoginAttemptService.
 *   Password rules are delegated to PasswordPolicyService.
 *   Token issuance is delegated to TokenService.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../common/email/email.service';
import { ConfigService } from '../common/config/config.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { LoginAttemptService } from './services/login-attempt.service';
import { TokenService } from './services/token.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nestConfig: NestConfigService,
    private readonly tenantConfig: ConfigService,
    private readonly email: EmailService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly loginAttempts: LoginAttemptService,
    private readonly tokens: TokenService,
  ) {}

  // ─────────────────────────────────────────── HELPERS

  private async hashPassword(plain: string): Promise<string> {
    const rounds = parseInt(
      this.nestConfig.get<string>('BCRYPT_SALT_ROUNDS', '12'),
      10,
    );
    return bcrypt.hash(plain, rounds);
  }

  private stripPassword<T extends { password?: string }>(user: T) {
    const { password, ...rest } = user;
    return rest;
  }

  private async getDefaultTenant() {
    return this.prisma.tenant.findFirst({ where: { isActive: true } });
  }

  private appBaseUrl(): string {
    return (
      this.nestConfig.get<string>('APP_URL') ??
      this.nestConfig.get<string>('FRONTEND_URL') ??
      'http://localhost:3000'
    );
  }

  // ─────────────────────────────────────────── REGISTER

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const tenantId =
      dto.tenantId ?? (await this.getDefaultTenant())?.id ?? null;

    if (tenantId) {
      await this.passwordPolicy.validate(tenantId, dto.password);
    }

    const hashed = await this.hashPassword(dto.password);
    const { password: _password, ...rest } = dto as RegisterDto &
      Record<string, unknown>;
    const userData: any = {
      ...rest,
      email: dto.email.trim().toLowerCase(),
      password: hashed,
      tenantId,
    };

    const user = await this.prisma.user.create({
      data: userData,
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    const access = await this.tokens.issueAccessToken({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });
    const refresh = await this.tokens.issueRefreshToken({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Welcome email — fire-and-forget
    this.email
      .send({
        to: user.email,
        toName: `${user.firstName} ${user.lastName}`,
        templateCode: 'welcome',
        tenantId: tenantId ?? undefined,
        variables: {
          tenant: { name: user.tenant?.name ?? 'Acadchestra' },
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          },
          links: { login: `${this.appBaseUrl()}/login` },
        },
      })
      .catch((err) =>
        this.logger.warn(`welcome email failed: ${err?.message}`),
      );

    return {
      user: this.stripPassword(user),
      token: access.token,
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresInSeconds,
    };
  }

  // ─────────────────────────────────────────── LOGIN

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    // Lockout check first to avoid timing leaks
    await this.loginAttempts.ensureNotLocked(null, email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      // Increment counter even for unknown emails to make enumeration harder
      await this.loginAttempts.recordFailure(null, email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Now we have tenantId — re-check lockout in tenant context
    await this.loginAttempts.ensureNotLocked(user.tenantId, email);

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    if (user.tenant && !user.tenant.isActive) {
      throw new UnauthorizedException('Tenant account is deactivated');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      await this.loginAttempts.recordFailure(user.tenantId, email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Success — clear counter
    this.loginAttempts.clear(email);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const access = await this.tokens.issueAccessToken({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });
    const refresh = await this.tokens.issueRefreshToken({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });

    return {
      user: this.stripPassword(user),
      token: access.token,
      accessToken: access.token,
      refreshToken: refresh.token,
      expiresIn: access.expiresInSeconds,
      mustChangePassword: user.mustChangePassword,
    };
  }

  // ─────────────────────────────────────────── REFRESH

  async refreshAccessToken(refreshToken: string) {
    const payload = this.tokens.verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    if (user.tenant && !user.tenant.isActive) {
      throw new UnauthorizedException('Tenant inactive');
    }

    const access = await this.tokens.issueAccessToken({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });
    const newRefresh = await this.tokens.issueRefreshToken({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });

    return {
      accessToken: access.token,
      refreshToken: newRefresh.token,
      expiresIn: access.expiresInSeconds,
    };
  }

  // ─────────────────────────────────────────── VALIDATE (LocalStrategy hook)

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { tenant: true },
    });
    if (!user || !user.isActive) return null;
    if (user.tenant && !user.tenant.isActive) return null;
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;
    return this.stripPassword(user);
  }

  // ─────────────────────────────────────────── PROFILE

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        student: true,
        teacher: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return this.stripPassword(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) throw new UnauthorizedException('User not found');

    // Honour admin-controlled "profile.allowedSelfEditFields" config
    const allowed = existing.tenantId
      ? await this.tenantConfig.getArray<string>(
          existing.tenantId,
          'profile',
          'allowedSelfEditFields',
          [
            'firstName',
            'lastName',
            'phone',
            'username',
            'dateOfBirth',
            'gender',
            'avatar',
          ],
        )
      : [
          'firstName',
          'lastName',
          'phone',
          'username',
          'dateOfBirth',
          'gender',
          'avatar',
        ];

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if (!allowed.includes(key)) continue;
      data[key] =
        key === 'dateOfBirth' && value ? new Date(value as string) : value;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        student: true,
        teacher: true,
      },
    });

    return this.stripPassword(updated);
  }

  // ─────────────────────────────────────────── CHANGE PASSWORD

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    if (user.tenantId) {
      // Optional: respect feature toggle
      const allowed = await this.tenantConfig.getBoolean(
        user.tenantId,
        'profile',
        'allowSelfPasswordChange',
        true,
      );
      if (!allowed) {
        throw new BadRequestException(
          'Password changes are disabled by your administrator',
        );
      }
      await this.passwordPolicy.validate(user.tenantId, newPassword);
    }

    const hashed = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: false },
    });

    return { message: 'Password changed successfully' };
  }

  // ─────────────────────────────────────────── FORGOT / RESET
  async forgotPassword(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (user && user.isActive) {
      const { rawToken, expiresInSeconds } = await this.tokens.createResetToken(
        user.id,
        user.tenantId,
      );

      const link = `${this.appBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

      this.email
        .send({
          to: user.email,
          toName: `${user.firstName} ${user.lastName}`,
          templateCode: 'password_reset',
          tenantId: user.tenantId ?? undefined,
          variables: {
            user: {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            },
            tenant: { name: user.tenant?.name ?? 'Acadchestra' },
            links: { reset: link },
            expiresIn: `${Math.round(expiresInSeconds / 60)} minutes`,
          },
        })
        .catch((err) =>
          this.logger.warn(`reset email failed: ${err?.message}`),
        );
    }

    return {
      message:
        'If an account exists for that email, a reset link has been sent.',
    };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    // Verify token, get userId, mark as used — all in one call
    const { userId } = await this.tokens.verifyAndConsumeResetToken(rawToken);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.tenantId) {
      await this.passwordPolicy.validate(user.tenantId, newPassword);
    }

    const hashed = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: false },
    });

    this.loginAttempts.clear(user.email);
    return { message: 'Password reset successfully' };
  }

  // ─────────────────────────────────────────── ADMIN-CREATED USERS

  async createUserWithPasswordReset(input: {
    email: string;
    firstName: string;
    lastName: string;
    tenantId: string;
    phone?: string;
    temporaryPassword: string;
    requirePasswordReset?: boolean;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashed = await this.hashPassword(input.temporaryPassword);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        password: hashed,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        tenantId: input.tenantId,
        mustChangePassword: input.requirePasswordReset ?? true,
        isEmailVerified: false,
      },
      include: { tenant: true },
    });

    this.email
      .send({
        to: user.email,
        toName: `${user.firstName} ${user.lastName}`,
        templateCode: 'temp_password',
        tenantId: input.tenantId,
        variables: {
          tenant: { name: tenant?.name ?? 'Acadchestra' },
          user: {
            firstName: user.firstName,
            email: user.email,
            temporaryPassword: input.temporaryPassword,
          },
          links: { login: `${this.appBaseUrl()}/login` },
        },
      })
      .catch((err) =>
        this.logger.warn(`temp password email failed: ${err?.message}`),
      );

    return this.stripPassword(user);
  }

  // ─────────────────────────────────────────── LOGOUT (stateless)

  async logout(_userId: string) {
    // For stateless JWT, logout is a client concern. If you ever introduce
    // a refresh-token table, revoke here. For now we just acknowledge.
    return { message: 'Logged out successfully' };
  }
}

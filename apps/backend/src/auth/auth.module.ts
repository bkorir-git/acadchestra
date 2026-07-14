/**
 * @file auth.module.ts
 * @module auth
 * @description Authentication module wiring. Imports DatabaseModule (for
 *   PrismaService), passport / JWT, and the global EmailModule + ConfigModule.
 *   Registers the new helper services: PasswordPolicyService, LoginAttemptService,
 *   TokenService.
 */

import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService as NestConfigService,
} from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from '../database/database.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PasswordPolicyService } from './services/password-policy.service';
import { LoginAttemptService } from './services/login-attempt.service';
import { TokenService } from './services/token.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [NestConfigService],
      useFactory: (cfg: NestConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: cfg.get<string>('JWT_EXPIRES_IN', '1h') as unknown as number,
        },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    PasswordPolicyService,
    LoginAttemptService,
    TokenService,
  ],
  exports: [AuthService, TokenService, PasswordPolicyService],
})
export class AuthModule {}
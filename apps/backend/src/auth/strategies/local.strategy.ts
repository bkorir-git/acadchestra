/**
 * @file local.strategy.ts
 * @description Passport local strategy used by login throttling middleware
 *   when present. Delegates to AuthService.validateUser, which itself runs the
 *   bcrypt comparison and tenant-active checks.
 */

import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.auth.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return user;
  }
}

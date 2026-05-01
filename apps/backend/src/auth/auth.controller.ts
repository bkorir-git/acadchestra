/**
 * @file auth.controller.ts
 * @module auth
 * @description Authentication HTTP endpoints.
 *
 *   Public:
 *     POST /auth/register
 *     POST /auth/login
 *     POST /auth/forgot-password
 *     POST /auth/reset-password
 *     POST /auth/refresh
 *
 *   Authenticated:
 *     GET  /auth/profile
 *     PATCH /auth/profile
 *     PATCH /auth/change-password
 *     POST /auth/logout
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ─────────────────────────────── REGISTER

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // ─────────────────────────────── LOGIN

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User successfully logged in' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // ─────────────────────────────── REFRESH

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refreshAccessToken(dto.refreshToken);
  }

  // ─────────────────────────────── FORGOT / RESET

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a reset token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  // ─────────────────────────────── PROFILE

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: any) {
    return this.auth.getProfile(user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  // ─────────────────────────────── CHANGE PASSWORD

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ─────────────────────────────── LOGOUT

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout (stateless acknowledgement)' })
  logout(@CurrentUser() user: any) {
    return this.auth.logout(user.id);
  }
}

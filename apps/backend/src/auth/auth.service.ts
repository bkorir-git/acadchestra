import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, tenantId } = registerDto;

    // Validate that tenantId is provided
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Check if tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new BadRequestException('Invalid tenant ID');
    }

    if (!tenant.isActive) {
      throw new BadRequestException('Tenant is not active');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = this.configService.get('BCRYPT_SALT_ROUNDS', 12);
    const hashedPassword = await bcrypt.hash(password, parseInt(saltRounds));

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        tenantId, // TypeScript now knows this is a string
      },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
    };

    const token = this.jwtService.sign(payload);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user with roles and permissions
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Check if tenant is active
    if (!user.tenant.isActive) {
      throw new UnauthorizedException('Tenant account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
    };

    const token = this.jwtService.sign(payload);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        student: true,
        teacher: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  //added

  async createUserWithPasswordReset(createUserData: any) {
  const { email, password, requirePasswordReset, ...userData } = createUserData;

  // Check if user already exists
  const existingUser = await this.prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictException('User with this email already exists');
  }

  // Hash temporary password
  const saltRounds = this.configService.get('BCRYPT_SALT_ROUNDS', 12);
  const hashedPassword = await bcrypt.hash(password, parseInt(saltRounds));

  // Create user
  const user = await this.prisma.user.create({
    data: {
      ...userData,
      email,
      password: hashedPassword,
      isEmailVerified: false, // Will be verified when they reset password
    },
    include: {
      tenant: true,
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  // Generate password reset token
  if (requirePasswordReset) {
    const resetToken = this.generateResetToken();
    
    // Store reset token (in production, store in Redis or database)
    // For now, we'll send it via email
    await this.sendPasswordResetEmail(user.email, user.firstName, resetToken);
  }

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

private generateResetToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

private async sendPasswordResetEmail(email: string, firstName: string, token: string) {
  // In production, integrate with email service (SendGrid, AWS SES, etc.)
  console.log(`
    Password Reset Email for ${firstName} (${email})
    
    Welcome to Acadchestra!
    
    Your account has been created. Please click the following link to set your password:
    ${this.configService.get('APP_URL')}/auth/reset-password?token=${token}
    
    This link will expire in 24 hours.
  `);
  
  // TODO: Implement actual email sending
  // await this.emailService.sendPasswordResetEmail(email, firstName, token);
}

async resetPassword(token: string, newPassword: string) {
  // In production, verify token from database/Redis
  // For now, we'll simulate successful reset
  
  // Validate password strength
  if (newPassword.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters long');
  }

  // Hash new password
  const saltRounds = this.configService.get('BCRYPT_SALT_ROUNDS', 12);
  const hashedPassword = await bcrypt.hash(newPassword, parseInt(saltRounds));

  // In production, find user by token and update password
  // const user = await this.prisma.user.findFirst({
  //   where: { resetToken: token, resetTokenExpiry: { gte: new Date() } }
  // });
  
  // For demo, return success
  return { message: 'Password reset successfully' };
}
}
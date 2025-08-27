import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './common/users/users.module';
import { TenantsModule } from './common/tenants/tenants.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { SystemModule } from './common/system/system.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RolesModule } from './common/roles/roles.module';
import { StudentsModule } from './students/students.module';
import { AcademicModule } from './academic/academic.module';
import { TeachersModule } from './teachers/teachers.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // 100 requests per minute
    }]),
    
    // Core modules
    DatabaseModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    SystemModule, 
    DashboardModule,
    RolesModule,
    StudentsModule,
    AcademicModule,
    TeachersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT guard (except for @Public routes)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
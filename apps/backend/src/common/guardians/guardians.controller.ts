/**
 * @file guardians.controller.ts
 * @module common/guardians
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { GuardiansService } from './guardians.service';
import {
  CreateGuardianDto,
  LinkGuardianDto,
  UpdateGuardianDto,
} from './dto/guardian.dto';

@ApiTags('Guardians')
@Controller('guardians')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GuardiansController {
  constructor(private readonly service: GuardiansService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  list(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.list(user.tenantId, {
      search,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.tenantId);
  }

  @Get(':id/students')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'List all students linked to this guardian' })
  studentsForGuardian(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.listStudentsForGuardian(id, user.tenantId);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  create(@Body() dto: CreateGuardianDto, @CurrentUser() user: any) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGuardianDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, user, dto);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  // ─── Student linking ────────────────────────────────────────
  @Post('link/:studentId')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Link an existing guardian to a student' })
  linkToStudent(
    @Param('studentId') studentId: string,
    @Body() dto: LinkGuardianDto,
    @CurrentUser() user: any,
  ) {
    return this.service.linkToStudent(user, studentId, dto);
  }

  @Delete('link/:studentId/:guardianId')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Unlink a guardian from a student' })
  unlink(
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.unlinkFromStudent(user, studentId, guardianId);
  }
}

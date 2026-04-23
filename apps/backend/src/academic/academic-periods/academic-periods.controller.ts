/**
 * @controller AcademicPeriodsController
 * @description REST endpoints for managing discrete periods in the calendar.
 *   Used to declare holidays, mid-term breaks, exam weeks.
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
import { AcademicPeriodType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AcademicPeriodsService } from './academic-periods.service';
import {
  CreateAcademicPeriodDto,
  UpdateAcademicPeriodDto,
} from './dto/academic-period.dto';

@ApiTags('Academic Periods')
@Controller('academic/periods')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AcademicPeriodsController {
  constructor(private readonly service: AcademicPeriodsService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  findAll(
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('type') type?: AcademicPeriodType,
  ) {
    return this.service.findAll(user, academicYearId, type);
  }

  @Get('current')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({ summary: 'Detect the period containing today' })
  current(
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.detectCurrentPeriod(
      user.tenantId,
      academicYearId,
      new Date(),
    );
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  create(@Body() dto: CreateAcademicPeriodDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicPeriodDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}

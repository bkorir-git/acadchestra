/**
 * @description Academic year endpoints with separate academic/financial lock actions.
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { LockAcademicYearDto } from './dto/lock-academic-year.dto';

@ApiTags('Academic Years')
@Controller('academic/years')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AcademicYearsController {
  constructor(private readonly service: AcademicYearsService) {}

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Create academic year with term validation' })
  create(@Body() dto: CreateAcademicYearDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiQuery({ name: 'includeTerms', required: false, type: Boolean })
  findAll(
    @CurrentUser() user: any,
    @Query('includeTerms') includeTerms?: string,
  ) {
    return this.service.findAll(user, includeTerms !== 'false');
  }

  @Get('current')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  current(@CurrentUser() user: any) {
    return this.service.getCurrentYear(user);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/set-current')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  setCurrent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.setCurrentYear(id, user);
  }

  @Patch(':id/lock/academic')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Apply ACADEMIC lock (blocks schema edits)' })
  lockAcademic(
    @Param('id') id: string,
    @Body() dto: LockAcademicYearDto,
    @CurrentUser() user: any,
  ) {
    return this.service.lockAcademic(id, dto, user);
  }

  @Patch(':id/lock/financial')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Apply FINANCIAL lock (blocks fee edits)' })
  lockFinancial(
    @Param('id') id: string,
    @Body() dto: LockAcademicYearDto,
    @CurrentUser() user: any,
  ) {
    return this.service.lockFinancial(id, dto, user);
  }

  @Patch(':id/archive')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  archive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.archive(id, user);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}

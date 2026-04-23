/**
 * @controller AcademicTermsController
 * @description REST endpoints for academic term lifecycle:
 *   GET /academic/terms               → list (optional academicYearId filter)
 *   GET /academic/terms/current       → currently active term
 *   GET /academic/terms/:id           → detail
 *   POST /academic/terms              → create
 *   POST /academic/terms/bulk         → bulk create
 *   PATCH /academic/terms/:id         → update
 *   PATCH /academic/terms/:id/activate    → activate (date-guarded)
 *   PATCH /academic/terms/:id/deactivate  → deactivate
 *   PATCH /academic/terms/:id/complete    → mark complete + lock
 *   PATCH /academic/terms/:id/lock        → apply academic/financial lock
 *   DELETE /academic/terms/:id        → remove
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
import { AcademicTermsService } from './academic-terms.service';
import {
  ActivateTermDto,
  BulkCreateAcademicTermsDto,
  CreateAcademicTermDto,
  LockTermDto,
  UpdateAcademicTermDto,
} from './dto/academic-term.dto';

@ApiTags('Academic Terms')
@Controller('academic/terms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AcademicTermsController {
  constructor(private readonly service: AcademicTermsService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'List all academic terms (optionally by year)' })
  findAll(
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findAll(user, academicYearId);
  }

  @Get('current')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({ summary: 'Get the currently active term' })
  current(@CurrentUser() user: any) {
    return this.service.findCurrent(user);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Create a new academic term' })
  create(@Body() dto: CreateAcademicTermDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Post('bulk')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Bulk create terms in a single transaction' })
  bulkCreate(
    @Body() dto: BulkCreateAcademicTermsDto,
    @CurrentUser() user: any,
  ) {
    return this.service.bulkCreate(dto, user);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicTermDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/activate')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Activate a term (date-guarded, single-active)' })
  activate(
    @Param('id') id: string,
    @Body() dto: ActivateTermDto,
    @CurrentUser() user: any,
  ) {
    return this.service.activate(id, dto ?? {}, user);
  }

  @Patch(':id/deactivate')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.deactivate(id, user);
  }

  @Patch(':id/complete')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Mark a term as completed (locks it)' })
  complete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.complete(id, user);
  }

  @Patch(':id/lock')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Apply academic and/or financial lock' })
  lock(
    @Param('id') id: string,
    @Body() dto: LockTermDto,
    @CurrentUser() user: any,
  ) {
    return this.service.lock(id, dto, user);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}

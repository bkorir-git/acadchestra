/**
 * @file fee-structures.controller.ts
 * @description REST endpoints for fee structures. Includes the new
 *   `quick-matrix` bulk creator, standard CRUD, level upserts, lock,
 *   versions, and the resolver endpoint used by the billing UI.
 *   All download endpoints are mounted under `/fees/downloads/...` —
 *   see `fee-downloads.controller.ts`.
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { FeeStructuresService } from './fee-structures.service';
import { FeeStructureVersionsService } from './fee-structure-versions.service';
import { FeeStructureResolverService } from './fee-structure-resolver.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { CreateQuickMatrixDto } from './dto/create-quick-matrix.dto';
import { UpsertLevelDto } from './dto/upsert-level.dto';
import { QueryFeeStructuresDto } from './dto/query-fee-structures.dto';

@ApiTags('Fee Structures')
@Controller('fees/structures')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FeeStructuresController {
  constructor(
    private readonly service: FeeStructuresService,
    private readonly versions: FeeStructureVersionsService,
    private readonly resolver: FeeStructureResolverService,
  ) {}

  @Post('quick-matrix')
  @FeeAccess('MANAGE')
  @ApiOperation({
    summary:
      'Curriculum-driven matrix creator: one structure per term, one level per row.',
  })
  createQuickMatrix(
    @Body() dto: CreateQuickMatrixDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createQuickMatrix(dto, user);
  }

  @Post()
  @FeeAccess('MANAGE')
  create(@Body() dto: CreateFeeStructureDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Get()
  @FeeAccess('READ_ONLY')
  findAll(@Query() query: QueryFeeStructuresDto, @CurrentUser() user: any) {
    return this.service.findAll(query, user);
  }

  @Get('resolve')
  @FeeAccess('READ_ONLY')
  @ApiOperation({ summary: 'Most-specific structure that applies to a student' })
  resolveForStudent(
    @Query('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('academicTermId') academicTermId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.resolver.resolveForStudentId(
      user.tenantId,
      studentId,
      academicYearId,
      academicTermId,
    );
  }

  @Get(':id')
  @FeeAccess('READ_ONLY')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @FeeAccess('MANAGE')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/lock')
  @FeeAccess('LOCK')
  lock(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.service.lock(id, reason, user);
  }

  @Post(':id/levels')
  @FeeAccess('MANAGE')
  upsertLevel(
    @Param('id') id: string,
    @Body() dto: UpsertLevelDto,
    @CurrentUser() user: any,
  ) {
    return this.service.upsertLevel(id, dto, user);
  }

  @Delete(':id/levels/:levelId')
  @FeeAccess('MANAGE')
  removeLevel(
    @Param('id') id: string,
    @Param('levelId') levelId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.removeLevel(id, levelId, user);
  }

  @Get(':id/versions')
  @FeeAccess('READ_ONLY')
  listVersions(@Param('id') id: string, @CurrentUser() user: any) {
    return this.versions.list(id, user.tenantId);
  }

  @Delete(':id')
  @FeeAccess('MANAGE')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
/**
 * @controller StudentsController
 * @description REST endpoints for students:
 *   GET /students                → paginated list with filters
 *   GET /students/:id            → detail
 *   GET /students/:id/full       → profile + history + fees + discounts
 *   POST /students               → enroll (creates User + Student atomically)
 *   PATCH /students/:id          → update
 *   POST /students/:id/transfer  → transfer between classes
 *   DELETE /students/:id         → soft delete (academicStatus=INACTIVE)
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
import { StudentsService } from './students.service';
import {
  CreateStudentDto,
  TransferStudentDto,
  UpdateStudentDto,
} from './dto/student.dto';

@ApiTags('Students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findAll(user, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      status,
      classId,
      academicYearId,
    });
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Get(':id/full')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({
    summary: 'Complete profile: history, fees, discounts, promotions',
  })
  full(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.fullProfile(id, user);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Enroll a new student (creates User + Student + history)',
  })
  enroll(@Body() dto: CreateStudentDto, @CurrentUser() user: any) {
    return this.service.enroll(dto, user);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/transfer')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Transfer student to another class',
  })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.transfer(id, dto, user);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}

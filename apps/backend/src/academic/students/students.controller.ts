/**
 * @file students.controller.ts
 * @module students
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
import { StudentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

@ApiTags('Students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  list(
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('classId') classId?: string,
    @Query('streamId') streamId?: string,
    @Query('status') status?: StudentStatus,
  ) {
    return this.service.list(user.tenantId, {
      page: Number(page),
      limit: Number(limit),
      search,
      classId,
      streamId,
      status,
    });
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student', 'Parent')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.tenantId);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary:
      'Admit a new student. Issues admission number, links guardians inline, sends confirmation email.',
  })
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: any) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, user, dto);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}

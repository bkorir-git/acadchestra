/**
 * @controller SubjectsController
 * @description REST endpoints for subjects + class↔subject assignments.
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
import { SubjectsService } from './subjects.service';
import {
  AssignSubjectToClassDto,
  CreateSubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';

@ApiTags('Subjects')
@Controller('academic/subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('gradeLevel') gradeLevel?: string,
    @Query('category') category?: string,
    @Query('department') department?: string,
  ) {
    return this.service.findAll(user, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      search,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      category,
      department,
    });
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  create(@Body() dto: CreateSubjectDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  @Post('assignments')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Assign (or re-assign) subject+teacher to class' })
  assign(@Body() dto: AssignSubjectToClassDto, @CurrentUser() user: any) {
    return this.service.assignToClass(dto, user);
  }

  @Delete('assignments/:classId/:subjectId')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  unassign(
    @Param('classId') classId: string,
    @Param('subjectId') subjectId: string,
  ) {
    return this.service.unassignFromClass(classId, subjectId);
  }
}

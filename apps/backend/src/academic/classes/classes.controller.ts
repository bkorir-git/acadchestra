/**
 * @file classes.controller.ts
 * @module academic/classes
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
import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';

@ApiTags('Classes')
@Controller('academic/classes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClassesController {
  constructor(private readonly service: ClassesService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('gradeId') gradeId?: string,
    @Query('classType') classType?: string,
    @Query('streamId') streamId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findAll(user, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      gradeId,
      classType,
      streamId,
      academicYearId,
    });
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Get(':id/students')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Roster of students enrolled in the class' })
  students(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findStudents(id, user);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  create(@Body() dto: CreateClassDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
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

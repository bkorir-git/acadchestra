/**
 * @controller ClassesController
 * @description REST endpoints for classes. Exposes stream drill-downs and
 *   per-class student listings to support UI navigation:
 *     /academic/classes?gradeLevel=3&stream=Science  — list by stream
 *     /academic/classes/streams                       — enumerate streams
 *     /academic/classes/:id                           — class detail
 *     /academic/classes/:id/students                  — students in class
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
    @Query('gradeLevel') gradeLevel?: string,
    @Query('classType') classType?: string,
    @Query('stream') stream?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findAll(user, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
      classType,
      stream,
      academicYearId,
    });
  }

  @Get('streams')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Enumerate distinct streams (optionally per year)' })
  streams(
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.listStreams(user, academicYearId);
  }

  @Get('by-stream/:stream')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'List classes belonging to a given stream label' })
  byStream(
    @Param('stream') stream: string,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findByStream(user, stream, academicYearId);
  }

  @Get('streams-for-grade')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({
    summary: 'Get allowed streams for a given academic year + grade level',
  })
  streamsForGrade(
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId: string,
    @Query('gradeLevel') gradeLevel: string,
  ) {
    return this.service.getStreamsForGrade(
      user.tenantId,
      academicYearId,
      Number(gradeLevel),
    );
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

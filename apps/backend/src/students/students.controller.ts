import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Create new student' })
  @ApiResponse({ status: 201, description: 'Student created successfully' })
  create(@Body() createStudentDto: CreateStudentDto, @CurrentUser() user: any) {
    return this.studentsService.create(createStudentDto, user.tenantId);
  }

  @Get()
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get all students with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'gradeLevel', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Students retrieved successfully' })
  findAll(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('classId') classId?: string,
    @Query('status') status?: string,
    @Query('gradeLevel', new DefaultValuePipe(0), ParseIntPipe) gradeLevel?: number,
  ) {
    return this.studentsService.findAll(user.tenantId, {
      page,
      limit,
      search,
      classId,
      status,
      gradeLevel: gradeLevel || undefined,
    });
  }

  @Get('stats')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Get student statistics' })
  @ApiResponse({ status: 200, description: 'Student statistics retrieved successfully' })
  getStats(@CurrentUser() user: any) {
    return this.studentsService.getStudentStats(user.tenantId);
  }

  @Get('class/:classId')
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get students by class' })
  @ApiResponse({ status: 200, description: 'Students retrieved successfully' })
  getStudentsByClass(@Param('classId') classId: string, @CurrentUser() user: any) {
    return this.studentsService.getStudentsByClass(classId, user.tenantId);
  }

  @Get(':id')
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get student by ID' })
  @ApiResponse({ status: 200, description: 'Student retrieved successfully' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.studentsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Update student' })
  @ApiResponse({ status: 200, description: 'Student updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @CurrentUser() user: any,
  ) {
    return this.studentsService.update(id, updateStudentDto, user.tenantId);
  }

  @Delete(':id')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Delete student' })
  @ApiResponse({ status: 200, description: 'Student deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.studentsService.remove(id, user.tenantId);
  }
}

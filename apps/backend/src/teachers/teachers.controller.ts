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
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Teachers')
@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Create new teacher' })
  @ApiResponse({ status: 201, description: 'Teacher created successfully' })
  create(@Body() createTeacherDto: CreateTeacherDto, @CurrentUser() user: any) {
    return this.teachersService.create(createTeacherDto, user.tenantId);
  }

  @Get()
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get all teachers with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Teachers retrieved successfully' })
  findAll(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('status') status?: string,
  ) {
    return this.teachersService.findAll(user.tenantId, {
      page,
      limit,
      search,
      department,
      status,
    });
  }

  @Get(':id')
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get teacher by ID' })
  @ApiResponse({ status: 200, description: 'Teacher retrieved successfully' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teachersService.findOne(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Delete teacher' })
  @ApiResponse({ status: 200, description: 'Teacher deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.teachersService.remove(id, user.tenantId);
  }
}

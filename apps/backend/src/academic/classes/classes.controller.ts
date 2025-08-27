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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Classes')
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Create new class' })
  @ApiResponse({ status: 201, description: 'Class created successfully' })
  create(@Body() createClassDto: CreateClassDto, @CurrentUser() user: any) {
    return this.classesService.create(createClassDto, user.tenantId);
  }

  @Get()
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get all classes with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'academicYearId', required: false, type: String })
  @ApiQuery({ name: 'gradeLevel', required: false, type: Number })
  @ApiQuery({ name: 'classType', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Classes retrieved successfully' })
  findAll(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('gradeLevel', new DefaultValuePipe(0), ParseIntPipe) gradeLevel?: number,
    @Query('classType') classType?: string,
  ) {
    return this.classesService.findAll(user.tenantId, {
      page,
      limit,
      search,
      academicYearId,
      gradeLevel: gradeLevel || undefined,
      classType,
    });
  }

  @Get('stats')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Get class statistics' })
  @ApiResponse({ status: 200, description: 'Class statistics retrieved successfully' })
  getStats(@CurrentUser() user: any) {
    return this.classesService.getClassStats(user.tenantId);
  }

  @Get('academic-year/:academicYearId')
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get classes by academic year' })
  @ApiResponse({ status: 200, description: 'Classes retrieved successfully' })
  getClassesByAcademicYear(@Param('academicYearId') academicYearId: string, @CurrentUser() user: any) {
    return this.classesService.getClassesByAcademicYear(academicYearId, user.tenantId);
  }

  @Get(':id')
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get class by ID' })
  @ApiResponse({ status: 200, description: 'Class retrieved successfully' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.classesService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Update class' })
  @ApiResponse({ status: 200, description: 'Class updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
    @CurrentUser() user: any,
  ) {
    return this.classesService.update(id, updateClassDto, user.tenantId);
  }

  @Delete(':id')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Delete class' })
  @ApiResponse({ status: 200, description: 'Class deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.classesService.remove(id, user.tenantId);
  }
}

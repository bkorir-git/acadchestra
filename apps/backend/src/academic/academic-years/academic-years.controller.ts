import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Academic Years')
@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Post()
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Create new academic year' })
  @ApiResponse({ status: 201, description: 'Academic year created successfully' })
  create(@Body() createAcademicYearDto: CreateAcademicYearDto, @CurrentUser() user: any) {
    return this.academicYearsService.create(createAcademicYearDto, user.tenantId);
  }

  @Get()
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get all academic years' })
  @ApiResponse({ status: 200, description: 'Academic years retrieved successfully' })
  findAll(
    @CurrentUser() user: any,
    @Query('includeTerms') includeTerms?: string,
  ) {
    const include = includeTerms !== 'false';
    return this.academicYearsService.findAll(user.tenantId, include);
  }

  @Get('current')
  @Roles('Admin', 'Principal', 'Teacher', 'Student', 'Parent')
  @ApiOperation({ summary: 'Get current academic year' })
  @ApiResponse({ status: 200, description: 'Current academic year retrieved successfully' })
  getCurrentYear(@CurrentUser() user: any) {
    return this.academicYearsService.getCurrentYear(user.tenantId);
  }

  @Get('active-terms')
  @Roles('Admin', 'Principal', 'Teacher', 'Student', 'Parent')
  @ApiOperation({ summary: 'Get active academic terms' })
  @ApiResponse({ status: 200, description: 'Active terms retrieved successfully' })
  getActiveTerms(@CurrentUser() user: any) {
    return this.academicYearsService.getActiveTerms(user.tenantId);
  }

  @Get(':id')
  @Roles('Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Get academic year by ID' })
  @ApiResponse({ status: 200, description: 'Academic year retrieved successfully' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.academicYearsService.findOne(id, user.tenantId);
  }

  @Patch(':id')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Update academic year' })
  @ApiResponse({ status: 200, description: 'Academic year updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateAcademicYearDto: UpdateAcademicYearDto,
    @CurrentUser() user: any,
  ) {
    return this.academicYearsService.update(id, updateAcademicYearDto, user.tenantId);
  }

  @Patch(':id/set-current')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Set as current academic year' })
  @ApiResponse({ status: 200, description: 'Current academic year updated successfully' })
  setCurrentYear(@Param('id') id: string, @CurrentUser() user: any) {
    return this.academicYearsService.setCurrentYear(id, user.tenantId);
  }

  @Delete(':id')
  @Roles('Admin', 'Principal')
  @ApiOperation({ summary: 'Delete academic year' })
  @ApiResponse({ status: 200, description: 'Academic year deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.academicYearsService.remove(id, user.tenantId);
  }
}

/**
 * @controller StudentClassHistoryController
 * @description Read/audit endpoints for the class-history ledger.
 */

import {
  Body,
  Controller,
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
import { StudentClassHistoryService } from './student-class-history.service';
import {
  CreateStudentClassHistoryDto,
  UpdateStudentClassHistoryDto,
} from './dto/student-class-history.dto';

@ApiTags('Student Class History')
@Controller('academic/class-history')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StudentClassHistoryController {
  constructor(private readonly service: StudentClassHistoryService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  list(
    @CurrentUser() user: any,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.list(user, { studentId, classId, academicYearId });
  }

  @Get('student/:studentId')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  forStudent(@Param('studentId') studentId: string, @CurrentUser() user: any) {
    return this.service.listForStudent(user.tenantId, studentId);
  }

  @Get('student/:studentId/current')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  current(@Param('studentId') studentId: string, @CurrentUser() user: any) {
    return this.service.currentForStudent(user.tenantId, studentId);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  create(@Body() dto: CreateStudentClassHistoryDto, @CurrentUser() user: any) {
    return this.service.createEntry(user.tenantId, dto, user.id);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentClassHistoryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post('audit')
  @Roles('SuperAdmin', 'Admin')
  @ApiOperation({ summary: 'Audit & repair denormalised Student.classId' })
  audit(@CurrentUser() user: any) {
    return this.service.audit(user.tenantId);
  }
}

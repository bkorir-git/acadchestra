/**
 * @controller AttendanceController
 * @description REST endpoints for the attendance module.
 *
 *   Lifecycle:
 *     POST   /attendance/sessions                     → open / upsert session
 *     GET    /attendance/sessions                     → list (paginated)
 *     GET    /attendance/sessions/:id                 → session detail w/ records
 *     POST   /attendance/sessions/:id/mark            → bulk mark
 *     PATCH  /attendance/sessions/:id/records/:rid    → edit single record
 *     PATCH  /attendance/sessions/:id/finalize        → finalize
 *     PATCH  /attendance/sessions/:id/lock            → admin lock
 *     DELETE /attendance/sessions/:id                 → admin delete
 *
 *   Class-scoped:
 *     GET    /attendance/classes/:classId/today       → today session or roster
 *     GET    /attendance/classes/:classId/stats       → date-window stats
 *     GET    /attendance/classes/:classId/report      → matrix (for CSV)
 *
 *   Student-scoped:
 *     GET    /attendance/students/:studentId/summary  → rate + recent
 *
 *   Dashboard:
 *     GET    /attendance/dashboard/today              → tenant rollup
 *     GET    /attendance/dashboard/trend              → daily series
 *
 *   Teacher:
 *     GET    /attendance/teacher/me/today             → classes + today status
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import {
  FinalizeSessionDto,
  ListSessionsQueryDto,
  LockSessionDto,
  MarkSessionDto,
  OpenSessionDto,
  StatsQueryDto,
  UpdateRecordDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  // ── Sessions
  @Post('sessions')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Open or return existing attendance session' })
  openSession(@Body() dto: OpenSessionDto, @CurrentUser() user: any) {
    return this.service.openSession(dto, user);
  }

  @Get('sessions')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  listSessions(@CurrentUser() user: any, @Query() q: ListSessionsQueryDto) {
    return this.service.listSessions(user, q);
  }

  @Get('sessions/:id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findSessionById(id, user);
  }

  @Post('sessions/:id/mark')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({ summary: 'Bulk mark attendance on a session' })
  mark(
    @Param('id') id: string,
    @Body() dto: MarkSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.markSession(id, dto, user);
  }

  @Patch('sessions/:id/records/:rid')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  updateRecord(
    @Param('id') id: string,
    @Param('rid') rid: string,
    @Body() dto: UpdateRecordDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateRecord(id, rid, dto, user);
  }

  @Patch('sessions/:id/finalize')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  finalize(
    @Param('id') id: string,
    @Body() dto: FinalizeSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.finalizeSession(id, dto, user);
  }

  @Patch('sessions/:id/lock')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  lock(
    @Param('id') id: string,
    @Body() dto: LockSessionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.lockSession(id, dto, user);
  }

  @Delete('sessions/:id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.deleteSession(id, user);
  }

  // ── Class-scoped
  @Get('classes/:classId/today')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  today(
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('date') date: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.getClassToday(classId, academicYearId, user, date);
  }

  @Get('classes/:classId/stats')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  classStats(
    @Param('classId') classId: string,
    @Query() q: StatsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.getClassStats(classId, user, q);
  }

  @Get('classes/:classId/report')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  report(
    @Param('classId') classId: string,
    @Query() q: StatsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.classReport(classId, user, q);
  }

  // ── Student-scoped
  @Get('students/:studentId/summary')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  studentSummary(
    @Param('studentId') studentId: string,
    @Query() q: StatsQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.getStudentSummary(studentId, user, q);
  }

  // ── Dashboard
  @Get('dashboard/today')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  dashboardToday(
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.dashboardToday(user, academicYearId);
  }

  @Get('dashboard/trend')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  dashboardTrend(@CurrentUser() user: any, @Query() q: StatsQueryDto) {
    return this.service.dashboardTrend(user, q);
  }

  // ── Teacher
  @Get('teacher/me/today')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  teacherToday(@CurrentUser() user: any) {
    return this.service.teacherToday(user);
  }
}

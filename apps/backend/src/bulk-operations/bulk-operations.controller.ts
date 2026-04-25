/**
 * @controller BulkOperationsController
 * @description REST endpoints for non-promotion bulk ops.
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BulkOperationsService } from './bulk-operations.service';
import { BulkStatusUpdateDto } from './dto/bulk-operations.dto';

@ApiTags('Bulk Operations')
@Controller('bulk')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BulkOperationsController {
  constructor(private readonly service: BulkOperationsService) {}

  @Post('student-status')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Bulk update student academic status' })
  statusUpdate(@Body() dto: BulkStatusUpdateDto, @CurrentUser() user: any) {
    return this.service.bulkStatusUpdate(dto, user);
  }
}

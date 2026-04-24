/**
 * @controller PromotionsController
 * @description Single-promotion endpoints only. Bulk workflow is the Plan engine.
 *     GET    /academic/promotions                    — paginated history
 *     POST   /academic/promotions                    — single ad-hoc promote
 *     POST   /academic/promotions/:studentId/undo    — revert last promotion
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromotionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PromotionsService } from './promotions.service';
import { PromoteStudentDto } from './dto/promotion.dto';

@ApiTags('Promotions')
@Controller('academic/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  list(
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: PromotionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(user, {
      academicYearId,
      studentId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'One-off promotion (mid-year transfer, admission correction)',
  })
  promote(@Body() dto: PromoteStudentDto, @CurrentUser() user: any) {
    return this.service.promote(dto, user);
  }

  @Post(':studentId/undo')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Revert last promotion for a student' })
  undo(@Param('studentId') studentId: string, @CurrentUser() user: any) {
    return this.service.undoLast(studentId, user);
  }
}

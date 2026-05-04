import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { ArrearsService } from './arrears.service';
import { ArrearsQueryDto, RollForwardDto } from './dto/arrears-query.dto';

@ApiTags('Arrears')
@Controller('fees/arrears')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class ArrearsController {
  constructor(private readonly service: ArrearsService) {}

  @Get()
  @FeeAccess('READ_ONLY')
  list(@Query() query: ArrearsQueryDto, @CurrentUser() user: any) {
    return this.service.list(query, user);
  }

  @Post('roll-forward')
  @FeeAccess('MANAGE')
  rollForward(@Body() dto: RollForwardDto, @CurrentUser() user: any) {
    return this.service.rollForward(dto, user);
  }
}

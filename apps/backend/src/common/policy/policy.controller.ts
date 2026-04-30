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
import { PolicyService } from './policy.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policy.dto';

@ApiTags('Policies')
@Controller('policies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PolicyController {
  constructor(private readonly service: PolicyService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  list(
    @CurrentUser() user: any,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.list(
      user,
      category,
      isActive === undefined ? undefined : isActive === 'true',
    );
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @Roles('SuperAdmin', 'Admin')
  create(@Body() dto: CreatePolicyDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  @Post('evaluate/:category')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Evaluate every active policy in a category against a context',
  })
  evaluate(
    @Param('category') category: string,
    @Body() body: { context: Record<string, unknown> },
    @CurrentUser() user: any,
  ) {
    return this.service.evaluate(user.tenantId, category, body.context ?? {});
  }
}

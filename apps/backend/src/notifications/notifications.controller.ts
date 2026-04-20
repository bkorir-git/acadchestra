/**
 * @description Notification endpoints for in-app feed.
 */

import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  list(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: NotificationType,
  ) {
    return this.service.list(user.tenantId, user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      unreadOnly: unreadOnly === 'true',
      type,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notifications count' })
  unread(@CurrentUser() user: any) {
    return this.service
      .getUnreadCount(user.tenantId, user.id)
      .then((count) => ({ count }));
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.markAsRead(id, user.tenantId, user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all as read' })
  markAllRead(@CurrentUser() user: any) {
    return this.service.markAllAsRead(user.tenantId, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.delete(id, user.tenantId, user.id);
  }
}
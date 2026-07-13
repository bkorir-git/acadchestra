/**
 * @file uploads.controller.ts
 * @description REST endpoints for the uploads module.
 *   POST   /uploads               multipart upload
 *   GET    /uploads               list (filtered by actor's tenant)
 *   GET    /uploads/:id           single asset metadata + URL
 *   GET    /uploads/:id/download  fresh signed download URL
 *   DELETE /uploads/:id           soft-delete + remove from storage
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestActor } from '../../common/types/request-actor.type';
import { UploadsService } from './uploads.service';
import {
  CreateUploadDto,
  DownloadUrlQueryDto,
  ListUploadsQueryDto,
} from './dto/uploads.dto';

const MAX_FILE_BYTES = 50 * 1024 * 1024; // hard upper bound (per-category limits applied in service)

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file (multipart/form-data)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        category: { type: 'string' },
        tenantId: { type: 'string' },
      },
      required: ['file', 'category'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() actor: RequestActor,
    @Body() dto: CreateUploadDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_FILE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploads.upload(actor, {
      file: {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size,
      },
      category: dto.category,
      tenantId: dto.tenantId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List uploads (tenant-scoped)' })
  list(
    @CurrentUser() actor: RequestActor,
    @Query() query: ListUploadsQueryDto,
  ) {
    return this.uploads.list(actor, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get upload metadata and resolved URL' })
  findOne(
    @CurrentUser() actor: RequestActor,
    @Param('id') id: string,
  ) {
    return this.uploads.findOne(id, actor);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get a fresh signed download URL' })
  download(
    @CurrentUser() actor: RequestActor,
    @Param('id') id: string,
    @Query() query: DownloadUrlQueryDto,
  ) {
    return this.uploads.getDownloadUrl(id, actor, query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete asset and remove file from storage' })
  remove(
    @CurrentUser() actor: RequestActor,
    @Param('id') id: string,
  ) {
    return this.uploads.remove(id, actor);
  }
}

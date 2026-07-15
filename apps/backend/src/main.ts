import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  const appUrl = configService.get<string>('APP_URL');
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      ...(appUrl ? [appUrl] : []),
    ],
    credentials: true,
  });

  // Global prefix
  const apiPrefix = configService.get('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  const uploadRoot = process.env.UPLOAD_ROOT
    ? join(process.cwd(), process.env.UPLOAD_ROOT)
    : join(process.cwd(), 'uploads');

  app.use(
    process.env.UPLOAD_PUBLIC_MOUNT || '/uploads',
    express.static(uploadRoot, {
      immutable: true,
      maxAge: '7d',
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Acadchestra API')
      .setDescription('Complete School Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get('PORT', 3001);
  await app.listen(port);

const apiUrl = configService.get<string>(
  'PUBLIC_BASE_URL',
  `http://localhost:${port}`,
);

  logger.log(`🚀 Acadchestra API is running on: ${apiUrl}/${apiPrefix}`);
  logger.log(`📚 API Documentation: ${apiUrl}/docs`);
}

bootstrap();

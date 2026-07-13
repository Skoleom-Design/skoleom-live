import 'reflect-metadata';
import { join } from 'path';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Serve extension bundles (content.js, background.js, CSS)
  app.use('/static', express.static(join(process.cwd(), 'static')));

  // Stockage local des médias (fallback quand S3 n'est pas configuré)
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.use('/api/files/local-upload', express.raw({ type: '*/*', limit: '200mb' }));

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : ['http://localhost:3001'],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`skoleomLive API running on :${port}`);
}

bootstrap();

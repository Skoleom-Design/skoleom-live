import 'reflect-metadata';
import { join } from 'path';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false — le parser JSON automatique de Nest (limite ~100kb par défaut) s'exécutait
  // avant express.raw() ci-dessous et bloquait tout upload vidéo avec "request entity too large",
  // même avec une limite de 200mb explicitement passée au middleware raw. En désactivant le parser
  // implicite, l'ordre d'exécution ci-dessous est garanti et déterministe.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Serve extension bundles (content.js, background.js, CSS)
  app.use('/static', express.static(join(process.cwd(), 'static')));

  // Stockage local des médias (fallback quand S3 n'est pas configuré)
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.use('/api/files/local-upload', express.raw({ type: () => true, limit: '200mb' }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  console.log(`skoleomLive running on :${port}`);
}

bootstrap();

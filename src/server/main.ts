// Doit s'executer avant tout le reste : AppModule (importe juste en dessous) charge en cascade
// toutes les entites, dont certaines lisent process.env.DB_HOST au chargement du module (voir
// timestamp-column.type.ts) pour choisir leur type de colonne — sans ce chargement explicite et
// synchrone du .env ici, ConfigModule.forRoot() ne le fait que plus tard, une fois les entites
// deja evaluees avec des valeurs par defaut incorrectes.
import 'dotenv/config';
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
  // NODE_ENV vaut "production" meme en dev local sur ce projet (voir .env — la base est un vrai
  // Supabase de prod, pas une base jetable), donc on ne peut pas s'en servir pour distinguer
  // "vrai" prod et dev local : FRONTEND_URL est toujours autorise, plus les ports locaux connus
  // (3001 = site Next.js, 5001 = app mobile Flutter lancee en web via --web-port=5001).
  const devOrigins = ['http://localhost:3001', 'http://localhost:5001'];
  const allowedOrigins = [...new Set([process.env.FRONTEND_URL, ...devOrigins])].filter(
    (o): o is string => Boolean(o),
  );
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // API_PORT (pas PORT) — sur Render, PORT est le port public assigne au process Next.js ;
  // Nest doit ecouter sur un port interne distinct pour eviter un conflit de binding.
  const port = process.env.API_PORT || process.env.PORT || 3000;
  await app.listen(port);
  console.log(`skoleomLive running on :${port}`);
}

bootstrap();

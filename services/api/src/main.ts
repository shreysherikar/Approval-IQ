import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

const corsOrigins = config
  .get<string>(
    'CORS_ORIGIN',
    'http://localhost:5173,http://127.0.0.1:5173',
  )
  .split(',');

app.enableCors({
  origin: corsOrigins,
  credentials: true,
});

  const swaggerConfig = new DocumentBuilder()
    .setTitle('ApprovalIQ API')
    .setDescription('Industrial approvals platform API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Manual smoke-test helpers (dev convenience, no auth): a landing page at
  // GET /api describing the service + a JSON health alias. Swagger UI stays at
  // GET /api/docs.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '')) {
      res.type('html').send(
        '<!doctype html><html><body style="font-family:sans-serif">' +
          '<h1>ApprovalIQ API</h1>' +
          '<p>API is running. Swagger UI: <a href="/api/docs">/api/docs</a></p>' +
          '<p>Health: <a href="/health">/health</a></p>' +
          '</body></html>',
      );
      return;
    }
    next();
  });

  // Silence browser favicon noise in dev logs.
  app.use('/favicon.ico', (_req: Request, res: Response) => {
    res.status(204).end();
  });

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  console.log(`ApprovalIQ API listening on port ${port}`);

  // Background cold-start database check
  const prisma = app.get(PrismaService);
  prisma.knowledgeRelease.count().then((count) => {
    if (count === 0) {
      console.log('ℹ️ Clean database detected: Run `pnpm run seed:demo` to populate full Maharashtra brewery demo dataset.');
    } else {
      console.log(`✓ Regulatory Knowledge Base active (${count} releases indexed).`);
    }
  }).catch(() => {
    // Database connecting asynchronously
  });
}

void bootstrap();

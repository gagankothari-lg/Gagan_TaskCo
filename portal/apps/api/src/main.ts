import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // Portal gets its own env-configured origin(s) in its own Render project, never LGDesk's.
  const corsOrigins = Array.from(new Set([process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean))) as string[];
  app.enableCors({ origin: corsOrigins, credentials: true });
  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`✅ Portal API running on port ${port} (prefix /api)`);
}
bootstrap();

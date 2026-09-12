import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException, ValidationError } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const constraints = errors[0]?.constraints ?? {};
        const values = Object.values(constraints);
        return new BadRequestException(values.length ? values[0] : 'Validation failed');
      },
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Portal gets its own env-configured origin(s) in its own Render project, never LGDesk's.
  const corsOrigins = Array.from(new Set([process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean))) as string[];
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`✅ Portal API running on port ${port} (prefix /api)`);
}
bootstrap();

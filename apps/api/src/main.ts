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
      transform: true,
      // Surface ONE clean message string (matching the DTO's custom messages),
      // so the HttpExceptionFilter can return { ok:false, error:"<message>" }.
      // Pick by constraint priority (e.g. "required" beats "must be a string")
      // so the message is deterministic regardless of decorator order.
      exceptionFactory: (errors: ValidationError[]) => {
        const priority = [
          'isNotEmpty', 'isEmail', 'isString', 'minLength', 'maxLength',
          'isInt', 'isNumber', 'isBoolean', 'isIn', 'isDateString', 'isArray',
        ];
        const constraints = errors[0]?.constraints ?? {};
        let message: string | undefined;
        for (const key of priority) {
          if (constraints[key]) {
            message = constraints[key];
            break;
          }
        }
        if (!message) {
          const values = Object.values(constraints);
          message = values.length ? values[0] : 'Validation failed';
        }
        return new BadRequestException(message);
      },
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.listen(3001);
  console.log('✅ LG Desk API running on http://localhost:3001/api');
}
bootstrap();

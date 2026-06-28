import { Controller, Get } from '@nestjs/common';

/**
 * Root health route. With the global 'api' prefix this is GET /api.
 * Public (no guard) and unwrapped by ResponseInterceptor → { ok:true, data:"Hello World" }.
 */
@Controller()
export class AppController {
  @Get()
  health(): string {
    return 'Hello World';
  }
}

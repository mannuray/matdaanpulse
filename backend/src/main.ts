import { tracingStatus } from './tracing'; // must stay the first import (instrumentation patching)
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { winstonLogger } from './common/logger/winston.config';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: winstonLogger,
    bodyParser: false, // configureApp registers the parsers with explicit limits
  });

  configureApp(app);
  // SIGTERM/SIGINT → Nest lifecycle hooks (GracefulShutdownService orders the teardown).
  app.enableShutdownHooks();

  const port = process.env.PORT || 3082;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Backend running on http://localhost:${port}`);
  logger.log(tracingStatus());
}

bootstrap().catch((err: Error) => {
  new Logger('Bootstrap').error(`Startup failed: ${err.message}`, err.stack);
  process.exit(1);
});

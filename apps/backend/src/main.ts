import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from 'src/app.module';
import { applyAppBootstrap } from 'src/bootstrap/apply-app-bootstrap';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: true,
    rawBody: true,
  });
  const logger = new Logger('Bootstrap');
  const result = await applyAppBootstrap(app);

  if (result.openApiOnly) {
    logger.log(`OpenAPI 文档已生成: ${result.openApiPath}`);
    await app.close();
    return;
  }

  await app.listen(result.port);

  logger.log(`Nest-Admin-Soybean 服务启动成功`);
  logger.log(`服务地址: http://localhost:${result.port}${result.prefix}/`);
  logger.log(`Swagger 文档: http://localhost:${result.port}${result.prefix}/swagger-ui/`);
  logger.log(`健康检查: http://localhost:${result.port}${result.prefix}/health`);
  logger.log(`Prometheus 指标: http://localhost:${result.port}${result.prefix}/metrics`);
}

bootstrap();

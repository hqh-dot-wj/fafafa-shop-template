import { TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { applyAppBootstrap } from '../../src/bootstrap/apply-app-bootstrap';

export interface E2eTestApp {
  app: NestExpressApplication;
  prefix: string;
  apiPath: (path: string) => string;
}

export async function createE2eApp(moduleFixture: TestingModule): Promise<E2eTestApp> {
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  const { prefix } = await applyAppBootstrap(app, {
    registerSwagger: false,
    writeOpenApi: false,
    usePinoLogger: false,
  });
  await app.init();

  return {
    app,
    prefix,
    apiPath: (path: string) => `${prefix}${path.startsWith('/') ? path : `/${path}`}`,
  };
}

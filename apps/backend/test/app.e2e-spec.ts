import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { createE2eApp } from './helpers/e2e-app';

/**
 * Backend E2E 冒烟测试
 * 验证应用启动成功，基础路由可访问
 * 前置：需启动 PostgreSQL、Redis（与 dev 环境一致）
 */
describe('Backend E2E 冒烟', () => {
  let app: INestApplication;
  let apiPath: (path: string) => string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const e2eApp = await createE2eApp(moduleFixture);
    app = e2eApp.app;
    apiPath = e2eApp.apiPath;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /captchaImage 应返回 200 及 captchaEnabled 字段', async () => {
    const res = await request(app.getHttpServer()).get(apiPath('/captchaImage'));
    expect(res.status).toBe(200);
    expect(res.body?.code).toBe(200);
    expect(res.body?.data).toHaveProperty('captchaEnabled');
  });

  it('GET /health/readiness 依赖就绪时应返回 200', async () => {
    const res = await request(app.getHttpServer()).get(apiPath('/health/readiness'));
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body?.status).toBe('ok');
    }
  });
});

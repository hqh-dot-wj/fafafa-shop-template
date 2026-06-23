import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2eApp } from './helpers/e2e-app';

/**
 * 管理端 OSS 列表路由注册冒烟（与 admin-web `/resource/oss/list` 对齐）
 *
 * 未带 Token 时应由全局 JwtAuthGuard 拦截，不得返回 404（否则多为路由未注册或前缀错误）。
 */
describe('Resource OSS 路由 E2E', () => {
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

  it('GET /resource/oss/list 应已注册（非 404）', async () => {
    const res = await request(app.getHttpServer())
      .get(apiPath('/resource/oss/list'))
      .query({ pageNum: 1, pageSize: 10, isAsc: 'descending', orderByColumn: 'createTime' });

    expect(res.status).not.toBe(404);
  });
});

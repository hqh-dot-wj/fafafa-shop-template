import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2eApp } from './helpers/e2e-app';

/**
 * C 端会员认证接口 E2E（短信/密码入口）
 * 前置：PostgreSQL、Redis 与 Prisma 与开发环境一致
 * 与生产 bootstrap 一致：通过 e2e helper 自动拼接 globalPrefix。
 */
describe('Member Auth E2E (client/auth)', () => {
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

  it('POST /client/auth/send-login-code 合法手机号应返回业务成功结构', async () => {
    const res = await request(app.getHttpServer())
      .post(apiPath('/client/auth/send-login-code'))
      .send({ mobile: '13800138000' })
      .expect(200);

    expect(res.body).toHaveProperty('code');
    expect(res.body.code).toBe(200);
  });

  it('POST /client/auth/send-login-code 非法手机号应校验失败', async () => {
    const res = await request(app.getHttpServer())
      .post(apiPath('/client/auth/send-login-code'))
      .send({ mobile: '123' });

    expect([400, 422]).toContain(res.status);
  });
});

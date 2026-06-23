import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseCode } from 'src/common/response';
import { createE2eApp } from './helpers/e2e-app';

/**
 * 管理端认证接口 E2E（短信发送、微信占位等）
 * 与生产 bootstrap 一致：通过 e2e helper 自动拼接 globalPrefix。
 * 依赖完整 AppModule：若 worktree 缺少 `src/module/admin/upload` 等文件，jest-e2e 会在加载阶段失败，请在完整仓库运行。
 */
describe('Admin Auth E2E (auth)', () => {
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

  it('POST /auth/send-login-code 合法手机号应返回业务成功结构', async () => {
    const res = await request(app.getHttpServer())
      .post(apiPath('/auth/send-login-code'))
      .set('tenant-id', '000000')
      .send({ mobile: '13800138000' })
      .expect(200);

    expect(res.body).toHaveProperty('code');
    expect(res.body.code).toBe(200);
  });

  it('POST /auth/send-login-code 非法手机号应校验失败', async () => {
    const res = await request(app.getHttpServer())
      .post(apiPath('/auth/send-login-code'))
      .set('tenant-id', '000000')
      .send({ mobile: '123' });

    expect([400, 422]).toContain(res.status);
  });

  it('POST /auth/social/wechat/callback 应返回未接入业务码', async () => {
    const res = await request(app.getHttpServer())
      .post(apiPath('/auth/social/wechat/callback'))
      .set('tenant-id', '000000')
      .send({})
      .expect(200);

    expect(res.body.code).toBe(ResponseCode.NOT_IMPLEMENTED);
    expect(res.body.msg).toContain('微信');
  });
});

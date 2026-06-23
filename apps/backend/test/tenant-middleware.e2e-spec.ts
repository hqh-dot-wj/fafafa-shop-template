import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/app-config.service';
import { ResponseCode } from '../src/common/response';
import { createE2eApp } from './helpers/e2e-app';

/**
 * Task 2 Step 3：租户中间件最小 E2E（治理计划）
 * 前置：与 `app.e2e-spec` 一致，需 PostgreSQL / Redis；**TENANT_ENABLED=true** 时「后台 403」断言才成立。
 */
describe('TenantMiddleware E2E（最小）', () => {
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

  it('后台路径未带 tenant-id 时应返回 403（strict_admin）', async () => {
    const tenantEnabled = app.get(AppConfigService).tenant.enabled;
    expect(tenantEnabled).toBe(true);

    const res = await request(app.getHttpServer()).get(apiPath('/system/tenant-middleware-e2e-probe'));
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe(ResponseCode.FORBIDDEN);
    expect(String(res.body?.msg ?? '')).toContain('tenant-id');
  });

  it('C 端 /client/* 未带头时应穿过中间件并返回 200（回落超级租户）', async () => {
    const res = await request(app.getHttpServer()).get(
      apiPath('/client/location/nearby-tenants?lat=39.9042&lng=116.4074'),
    );
    expect(res.status).toBe(200);
    expect(res.body?.code).toBe(ResponseCode.SUCCESS);
  });
});

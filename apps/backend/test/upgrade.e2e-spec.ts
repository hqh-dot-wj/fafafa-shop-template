import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Injectable, CanActivate, ExecutionContext, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
// import { UpgradeModule } from '../src/module/client/upgrade/upgrade.module'; // Define inline
import { UpgradeController } from '../src/module/client/upgrade/upgrade.controller';
import { UpgradeService } from '../src/module/client/upgrade/upgrade.service';
import { LoggerModule } from '../src/common/logger';
import configuration from '../src/config/index';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { MemberStatus } from '@prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { AppConfigModule } from '../src/config/app-config.module';
import { MemberAuthGuard } from '../src/module/client/common/guards/member-auth.guard';
import { PassportModule } from '@nestjs/passport';
import { WechatService } from '../src/module/client/common/service/wechat.service';
import { UploadService } from '../src/module/admin/upload/upload.service';

const mockWechatService = {
  getWxaCodeUnlimited: jest.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
};
const mockUploadService = {
  singleFileUpload: jest.fn().mockResolvedValue({ url: 'https://test.example/qr.png' }),
};

// Mock nanoid to avoid ESM issues
jest.mock('nanoid', () => ({
  nanoid: () => 'mock_nanoid_123',
}));

// Mock LoggerModule to avoid pino crash on import
jest.mock('../src/common/logger', () => ({
  LoggerModule: class MockLoggerModule {},
}));

const TEST_JWT_SECRET = 'test-secret-key-123';

@Injectable()
class MockMemberAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    if (!authHeader) return false;

    const token = authHeader.split(' ')[1];
    if (!token) return false;

    try {
      const parts = token.split('.');
      if (parts.length < 2) return false;

      const payloadBase64 = parts[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString();
      const payload = JSON.parse(payloadJson);

      req.user = payload;
      return true;
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return false;
    }
  }
}

describe('Upgrade & Commission (e2e) - Inline', () => {
  let app: INestApplication;
  let apiPath: (path: string) => string;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Test Users
  let userC: any;
  let userL1: any;
  let userL2: any;
  let tokenC: string;
  let tokenL1: string;
  let tokenL2: string;

  beforeAll(async () => {
    try {
      console.log('Starting E2E Test Setup (Inline)...');
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            envFilePath: ['.env'],
          }),
          JwtModule.register({
            secret: TEST_JWT_SECRET,
            signOptions: { expiresIn: '1h' },
          }),
          PassportModule,
          AppConfigModule,
          PrismaModule,
          LoggerModule,
        ],
        controllers: [UpgradeController],
        providers: [
          UpgradeService,
          MemberAuthGuard,
          { provide: WechatService, useValue: mockWechatService },
          { provide: UploadService, useValue: mockUploadService },
        ],
      })
        .overrideModule(LoggerModule)
        .useModule(class MockLoggerModule {})
        .overrideGuard(MemberAuthGuard)
        .useClass(MockMemberAuthGuard)
        .compile();

      console.log('Module compiled.');

      app = moduleFixture.createNestApplication();
      const appPrefix = configuration().app.prefix || '/api';
      apiPath = (path: string) => `${appPrefix}${path.startsWith('/') ? path : `/${path}`}`;
      app.setGlobalPrefix(appPrefix);
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
        }),
      );
      await app.init();
      console.log('App initialized.');

      // Use strict: false to ensure we can get providers from global modules
      prisma = moduleFixture.get<PrismaService>(PrismaService, { strict: false });
      jwtService = moduleFixture.get<JwtService>(JwtService);

      console.log('PrismaService initialized:', !!prisma);
      if (!prisma) throw new Error('PrismaService not initialized');

      await cleanupData(prisma);

      console.log('Creating test users...');
      const mobileSuffix = `${Date.now()}`.slice(-8);
      userL2 = await createUser(prisma, 'user_l2', `138${mobileSuffix}02`, 2, null, null);
      userL1 = await createUser(prisma, 'user_l1', `138${mobileSuffix}01`, 1, userL2.memberId, userL2.memberId);
      userC = await createUser(prisma, 'user_c', `138${mobileSuffix}00`, 0, userL1.memberId, userL2.memberId);

      tokenC = genToken(userC);
      tokenL1 = genToken(userL1);
      tokenL2 = genToken(userL2);
      console.log('Test users created.');
    } catch (error) {
      console.error('Test Setup Failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await cleanupData(prisma);
      if (app) await app.close();
    } catch (e) {
      console.error('Teardown failed:', e);
    }
  });

  async function cleanupData(p: PrismaService) {
    if (!p) return;

    const existing = await p.umsMember.findMany({
      where: { nickname: { in: ['user_c', 'user_l1', 'user_l2'] } },
      select: { memberId: true },
    });
    const mids = existing.map((m) => m.memberId);
    if (mids.length > 0) {
      await p.umsUpgradeApply.deleteMany({ where: { memberId: { in: mids } } });
      await p.umsReferralCode.deleteMany({ where: { memberId: { in: mids } } });
      await p.omsOrderItem.deleteMany({
        where: { order: { memberId: { in: mids } } },
      });
      await p.omsOrder.deleteMany({ where: { memberId: { in: mids } } });
    }
    await p.umsMember.deleteMany({
      where: { nickname: { in: ['user_c', 'user_l1', 'user_l2'] } },
    });
  }

  async function createUser(
    p: PrismaService,
    username: string,
    mobile: string,
    levelId: number,
    parentId: string | null,
    indirectParentId: string | null,
  ) {
    if (!p) throw new Error('Prisma is explicitly undefined');

    return p.umsMember.create({
      data: {
        mobile,
        password: 'hash',
        levelId,
        parentId,
        indirectParentId,
        tenantId: '000000',
        status: MemberStatus.NORMAL,
        nickname: username,
        avatar: '',
      },
    });
  }

  function genToken(user: any) {
    const payload = {
      username: user.nickname,
      sub: user.memberId,
      memberId: user.memberId,
      role: 'client',
      tenantId: user.tenantId,
    };
    return 'Bearer ' + jwtService.sign(payload);
  }

  // --- Tests ---

  describe('1. Upgrade API', () => {
    it('should allow L1 to see team stats', async () => {
      const res = await request(app.getHttpServer())
        .get(apiPath('/client/upgrade/team/stats'))
        .set('Authorization', tokenL1)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.myLevel).toBe(1);
      expect(res.body.data.directCount).toBe(1);
    });

    it('should allow C2 (L2) to get referral code', async () => {
      const res = await request(app.getHttpServer())
        .get(apiPath('/client/upgrade/referral-code'))
        .set('Authorization', tokenL2)
        .expect(200);

      expect(res.body.code).toBe(200);
      expect(res.body.data.code).toBeDefined();
      expect(res.body.data.code).toMatch(/^0000-/);
    });

    it('should create upgrade application', async () => {
      const res = await request(app.getHttpServer())
        .post(apiPath('/client/upgrade/apply'))
        .set('Authorization', tokenC)
        .send({
          targetLevel: 1,
          applyType: 'PRODUCT_PURCHASE',
        })
        .expect(201); // 201 Created

      expect(res.body.code).toBe(200);

      const apply = await prisma.umsUpgradeApply.findFirst({
        where: { memberId: userC.memberId },
        orderBy: { createTime: 'desc' },
      });
      expect(apply).toBeTruthy();
      expect(apply?.status).toBe('APPROVED');

      const memberAfter = await prisma.umsMember.findUnique({
        where: { memberId: userC.memberId },
      });
      expect(memberAfter?.levelId).toBe(1);
    });
  });
});

import { Test } from '@nestjs/testing';
import { AppConfigService } from 'src/config/app-config.service';
import { OssStorageService } from './oss-storage.service';

const fullOssConfig = {
  accessKeyId: 'test-id',
  accessKeySecret: 'test-secret',
  region: 'oss-cn-beijing',
  bucket: 'nest-admin',
  endpoint: 'oss-cn-beijing.aliyuncs.com',
  publicBaseUrl: 'https://nest-admin.oss-cn-beijing.aliyuncs.com',
  prefix: 'uploads/',
};

describe('OssStorageService', () => {
  it('isConfigured 在六项均非空时为 true', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OssStorageService,
        { provide: AppConfigService, useValue: { oss: fullOssConfig } },
      ],
    }).compile();
    expect(moduleRef.get(OssStorageService).isConfigured()).toBe(true);
  });

  it('isConfigured 在缺少 secret 时为 false', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OssStorageService,
        {
          provide: AppConfigService,
          useValue: { oss: { ...fullOssConfig, accessKeySecret: '' } },
        },
      ],
    }).compile();
    expect(moduleRef.get(OssStorageService).isConfigured()).toBe(false);
  });

  it('buildObjectKey 拼接前缀与相对路径', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OssStorageService,
        { provide: AppConfigService, useValue: { oss: fullOssConfig } },
      ],
    }).compile();
    const service = moduleRef.get(OssStorageService);
    expect(service.buildObjectKey('2026/04/13/a.png')).toBe('uploads/2026/04/13/a.png');
  });

  it('无前缀时 buildObjectKey 仅返回相对路径', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OssStorageService,
        {
          provide: AppConfigService,
          useValue: { oss: { ...fullOssConfig, prefix: '' } },
        },
      ],
    }).compile();
    expect(moduleRef.get(OssStorageService).buildObjectKey('2026/04/13/a.png')).toBe('2026/04/13/a.png');
  });

  it('buildPublicUrl 与 parseObjectKeyFromPublicUrl 互逆', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OssStorageService,
        { provide: AppConfigService, useValue: { oss: fullOssConfig } },
      ],
    }).compile();
    const service = moduleRef.get(OssStorageService);
    const key = 'uploads/2026/04/13/x.png';
    const url = service.buildPublicUrl(key);
    expect(url).toBe('https://nest-admin.oss-cn-beijing.aliyuncs.com/uploads/2026/04/13/x.png');
    expect(service.parseObjectKeyFromPublicUrl(url)).toBe(key);
  });
});

import { Test } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { AppConfigService } from 'src/config/app-config.service';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { OssStorageService } from './services/oss-storage.service';
import { recoverOriginalFilenameFromMultipart, UploadService } from './upload.service';

describe('recoverOriginalFilenameFromMultipart', () => {
  it('已是正常中文文件名时不改写', () => {
    expect(recoverOriginalFilenameFromMultipart('  测试照片.jpg  ')).toBe('测试照片.jpg');
  });

  it('纯 ASCII 不处理', () => {
    expect(recoverOriginalFilenameFromMultipart('photo_2024.jpg')).toBe('photo_2024.jpg');
  });

  it('UTF-8 字节被误解为 latin1 时可还原为中文', () => {
    const wrong = Buffer.from('春季活动.png', 'utf8').toString('latin1');
    expect(recoverOriginalFilenameFromMultipart(wrong)).toBe('春季活动.png');
  });

  it('undefined 保持 undefined', () => {
    expect(recoverOriginalFilenameFromMultipart(undefined)).toBeUndefined();
  });
});

describe('UploadService', () => {
  /** 254 + 4 = 258 > 255（sys_upload.file_name） */
  const longName = `${'n'.repeat(254)}.txt`;

  async function createService(overrides?: {
    oss?: Partial<{
      putObject: jest.Mock;
      buildPublicUrl: jest.Mock;
      buildObjectKey: jest.Mock;
      isConfigured: boolean;
    }>;
  }) {
    const putObject = overrides?.oss?.putObject ?? jest.fn().mockResolvedValue(undefined);
    const buildPublicUrl =
      overrides?.oss?.buildPublicUrl ?? jest.fn().mockReturnValue('https://example.com/short');
    const buildObjectKey = overrides?.oss?.buildObjectKey ?? jest.fn().mockReturnValue('k');
    const isConfigured = overrides?.oss?.isConfigured ?? true;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: PrismaService,
          useValue: {
            sysUpload: { create: jest.fn().mockResolvedValue({}) },
            sysTenant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          },
        },
        {
          provide: TenantHelper,
          useValue: {
            getTenantId: jest.fn().mockReturnValue('000000'),
            setTenantId: jest.fn((d: object) => ({ ...d, tenantId: '000000' })),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            app: {
              file: {
                isLocal: false,
                location: 'uploads',
                serveRoot: '/profile',
                domain: 'http://localhost:8080',
              },
            },
            oss: {},
          },
        },
        {
          provide: OssStorageService,
          useValue: {
            isConfigured: jest.fn().mockReturnValue(isConfigured),
            putObject,
            buildObjectKey,
            buildPublicUrl,
            deleteObjectByPublicUrl: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    return moduleRef.get(UploadService);
  }

  it('OSS 模式下公网 URL 超过库表长度时应抛出业务异常且不应调用 putObject', async () => {
    const putObject = jest.fn().mockResolvedValue(undefined);
    const longUrl = `https://x.com/${'p'.repeat(487)}`;
    const service = await createService({
      oss: {
        putObject,
        buildPublicUrl: jest.fn().mockReturnValue(longUrl),
        buildObjectKey: jest.fn().mockReturnValue('uploads/2026/01/01/x.bin'),
      },
    });

    const file = {
      fieldname: 'file',
      originalname: 'a.bin',
      encoding: '7bit',
      mimetype: 'application/octet-stream',
      size: 1,
      buffer: Buffer.from('x'),
      destination: '',
      filename: '',
      path: '',
    } as Express.Multer.File;

    await expect(service.singleFileUpload(file)).rejects.toMatchObject({
      errorCode: ResponseCode.PARAM_INVALID,
    });
    expect(putObject).not.toHaveBeenCalled();
  });

  it('原始文件名超过 255 字符时应抛出业务异常', async () => {
    const service = await createService();
    const file = {
      fieldname: 'file',
      originalname: longName,
      encoding: '7bit',
      mimetype: 'text/plain',
      size: 1,
      buffer: Buffer.from('x'),
      destination: '',
      filename: '',
      path: '',
    } as Express.Multer.File;

    await expect(service.singleFileUpload(file)).rejects.toBeInstanceOf(BusinessException);
  });

  it('uploadFromBuffer 应委托 singleFileUpload 并成功写入 OSS', async () => {
    const putObject = jest.fn().mockResolvedValue(undefined);
    const service = await createService({ oss: { putObject } });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const r = await service.uploadFromBuffer({
      buffer: png,
      originalName: 'a.png',
      mimeType: 'image/png',
    });
    expect(r.url).toBeTruthy();
    expect(putObject).toHaveBeenCalled();
  });
});
